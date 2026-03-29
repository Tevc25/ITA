const { v4: uuidv4 } = require("uuid");
const { ddb, GetCommand, PutCommand, UpdateCommand } = require("../../common/db");
const { getUserIdFromEvent, parseBody } = require("../../common/http");
const { badRequest, unauthorized, conflict, created, serverError } = require("../../common/response");

const PARKING_LOTS_TABLE = process.env.PARKING_LOTS_TABLE;
const RESERVATIONS_TABLE = process.env.RESERVATIONS_TABLE;

exports.handler = async (event) => {
  const userId = getUserIdFromEvent(event);
  if (!userId) {
    return unauthorized();
  }

  const body = parseBody(event);
  if (!body) {
    return badRequest("Invalid JSON body");
  }

  const parkingLotId = String(body.parkingLotId || "").trim();
  const vehiclePlate = String(body.vehiclePlate || "").trim().toUpperCase();
  const startTime = String(body.startTime || "").trim();
  const endTime = String(body.endTime || "").trim();

  if (!parkingLotId || !vehiclePlate || !startTime || !endTime) {
    return badRequest("parkingLotId, vehiclePlate, startTime and endTime are required");
  }

  if (new Date(startTime).toString() === "Invalid Date" || new Date(endTime).toString() === "Invalid Date") {
    return badRequest("startTime and endTime must be valid ISO dates");
  }

  if (new Date(startTime) >= new Date(endTime)) {
    return badRequest("startTime must be before endTime");
  }

  try {
    const parkingResult = await ddb.send(
      new GetCommand({
        TableName: PARKING_LOTS_TABLE,
        Key: { parkingLotId },
      }),
    );

    const parkingLot = parkingResult.Item;
    if (!parkingLot) {
      return badRequest("Parking lot does not exist");
    }

    if (Number(parkingLot.availableSpots || 0) <= 0) {
      return conflict("No available parking spots");
    }

    await ddb.send(
      new UpdateCommand({
        TableName: PARKING_LOTS_TABLE,
        Key: { parkingLotId },
        ConditionExpression: "availableSpots > :zero",
        UpdateExpression: "SET availableSpots = availableSpots - :one, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":zero": 0,
          ":one": 1,
          ":updatedAt": new Date().toISOString(),
        },
      }),
    );

    const reservationId = uuidv4();
    const now = new Date().toISOString();

    const item = {
      userId,
      reservationId,
      parkingLotId,
      vehiclePlate,
      startTime,
      endTime,
      status: "active",
      evidenceStatus: "pending",
      createdAt: now,
      updatedAt: now,
    };

    await ddb.send(
      new PutCommand({
        TableName: RESERVATIONS_TABLE,
        Item: item,
      }),
    );

    return created({ reservation: item });
  } catch (error) {
    if (error?.name === "ConditionalCheckFailedException") {
      return conflict("No available parking spots");
    }

    console.error("createReservation failed", error);
    return serverError("Could not create reservation");
  }
};
