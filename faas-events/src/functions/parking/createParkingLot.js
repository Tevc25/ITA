const { v4: uuidv4 } = require("uuid");
const { ddb, PutCommand } = require("../../common/db");
const { parseBody } = require("../../common/http");
const { badRequest, created, serverError } = require("../../common/response");

const PARKING_LOTS_TABLE = process.env.PARKING_LOTS_TABLE;

exports.handler = async (event) => {
  const body = parseBody(event);
  if (!body) {
    return badRequest("Invalid JSON body");
  }

  const name = String(body.name || "").trim();
  const location = String(body.location || "").trim();
  const capacity = Number(body.capacity || 0);
  const requestedAvailable = Number(body.availableSpots ?? capacity);

  if (!name || !location || !Number.isFinite(capacity) || capacity <= 0) {
    return badRequest("name, location and capacity (> 0) are required");
  }

  const availableSpots = Math.max(0, Math.min(capacity, requestedAvailable));

  const parkingLotId = uuidv4();
  const now = new Date().toISOString();

  try {
    await ddb.send(
      new PutCommand({
        TableName: PARKING_LOTS_TABLE,
        Item: {
          parkingLotId,
          name,
          location,
          capacity,
          availableSpots,
          createdAt: now,
          updatedAt: now,
        },
      }),
    );

    return created({
      parkingLotId,
      name,
      location,
      capacity,
      availableSpots,
    });
  } catch (error) {
    console.error("createParkingLot failed", error);
    return serverError("Could not create parking lot");
  }
};
