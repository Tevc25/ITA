const { ddb, UpdateCommand } = require("../../common/db");
const { parseBody } = require("../../common/http");
const { badRequest, json, serverError } = require("../../common/response");

const PARKING_LOTS_TABLE = process.env.PARKING_LOTS_TABLE;

exports.handler = async (event) => {
  const parkingLotId = event?.pathParameters?.parkingLotId;
  const body = parseBody(event);

  if (!parkingLotId) {
    return badRequest("parkingLotId is required");
  }

  if (!body) {
    return badRequest("Invalid JSON body");
  }

  const availableSpots = Number(body.availableSpots);
  if (!Number.isFinite(availableSpots) || availableSpots < 0) {
    return badRequest("availableSpots must be a non-negative number");
  }

  try {
    const result = await ddb.send(
      new UpdateCommand({
        TableName: PARKING_LOTS_TABLE,
        Key: { parkingLotId },
        ConditionExpression: "attribute_exists(parkingLotId)",
        UpdateExpression: "SET availableSpots = :availableSpots, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":availableSpots": availableSpots,
          ":updatedAt": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      }),
    );

    return json(200, {
      parkingLot: result.Attributes,
    });
  } catch (error) {
    if (error?.name === "ConditionalCheckFailedException") {
      return badRequest("Parking lot does not exist");
    }

    console.error("updateParkingAvailability failed", error);
    return serverError("Could not update availability");
  }
};
