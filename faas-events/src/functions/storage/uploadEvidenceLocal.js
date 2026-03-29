const { ddb, QueryCommand, UpdateCommand } = require("../../common/db");
const { badRequest, notFound, json, serverError } = require("../../common/response");

const RESERVATIONS_TABLE = process.env.RESERVATIONS_TABLE;

exports.handler = async (event) => {
  const reservationId = event?.pathParameters?.reservationId;
  if (!reservationId) {
    return badRequest("reservationId is required");
  }

  try {
    const lookup = await ddb.send(
      new QueryCommand({
        TableName: RESERVATIONS_TABLE,
        IndexName: "reservationId-index",
        KeyConditionExpression: "reservationId = :reservationId",
        ExpressionAttributeValues: {
          ":reservationId": reservationId,
        },
        Limit: 1,
      }),
    );

    const reservation = lookup.Items?.[0];
    if (!reservation) {
      return notFound("Reservation not found");
    }

    const objectKey = `local/reservations/${reservationId}/${Date.now()}-evidence`;

    await ddb.send(
      new UpdateCommand({
        TableName: RESERVATIONS_TABLE,
        Key: {
          userId: reservation.userId,
          reservationId,
        },
        UpdateExpression: "SET evidenceStatus = :uploaded, evidenceObjectKey = :objectKey, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":uploaded": "uploaded",
          ":objectKey": objectKey,
          ":updatedAt": new Date().toISOString(),
        },
      }),
    );

    return json(200, {
      reservationId,
      objectKey,
      status: "uploaded",
      local: true,
    });
  } catch (error) {
    console.error("uploadEvidenceLocal failed", error);
    return serverError("Could not process local evidence upload");
  }
};
