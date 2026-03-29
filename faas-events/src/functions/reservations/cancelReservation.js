const { ddb, GetCommand, UpdateCommand } = require("../../common/db");
const { getUserIdFromEvent } = require("../../common/http");
const { unauthorized, badRequest, notFound, conflict, json, serverError } = require("../../common/response");

const RESERVATIONS_TABLE = process.env.RESERVATIONS_TABLE;
const PARKING_LOTS_TABLE = process.env.PARKING_LOTS_TABLE;

exports.handler = async (event) => {
  const userId = getUserIdFromEvent(event);
  if (!userId) {
    return unauthorized();
  }

  const reservationId = event?.pathParameters?.reservationId;
  if (!reservationId) {
    return badRequest("reservationId is required");
  }

  try {
    const existing = await ddb.send(
      new GetCommand({
        TableName: RESERVATIONS_TABLE,
        Key: { userId, reservationId },
      }),
    );

    const reservation = existing.Item;
    if (!reservation) {
      return notFound("Reservation not found");
    }

    if (reservation.status !== "active") {
      return conflict("Only active reservations can be cancelled");
    }

    const updated = await ddb.send(
      new UpdateCommand({
        TableName: RESERVATIONS_TABLE,
        Key: { userId, reservationId },
        ConditionExpression: "#status = :active",
        UpdateExpression: "SET #status = :cancelled, updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":active": "active",
          ":cancelled": "cancelled",
          ":updatedAt": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      }),
    );

    await ddb.send(
      new UpdateCommand({
        TableName: PARKING_LOTS_TABLE,
        Key: { parkingLotId: reservation.parkingLotId },
        UpdateExpression: "SET availableSpots = availableSpots + :one, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":one": 1,
          ":updatedAt": new Date().toISOString(),
        },
      }),
    );

    return json(200, {
      reservation: updated.Attributes,
    });
  } catch (error) {
    if (error?.name === "ConditionalCheckFailedException") {
      return conflict("Reservation has already changed state");
    }

    console.error("cancelReservation failed", error);
    return serverError("Could not cancel reservation");
  }
};
