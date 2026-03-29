const { ddb, ScanCommand } = require("../../common/db");
const { json, serverError } = require("../../common/response");

const PARKING_LOTS_TABLE = process.env.PARKING_LOTS_TABLE;

exports.handler = async (event) => {
  const onlyAvailable = String(event?.queryStringParameters?.onlyAvailable || "false").toLowerCase() === "true";

  try {
    const result = await ddb.send(
      new ScanCommand({
        TableName: PARKING_LOTS_TABLE,
      }),
    );

    const allLots = result.Items || [];
    const parkingLots = onlyAvailable
      ? allLots.filter((lot) => Number(lot.availableSpots || 0) > 0)
      : allLots;

    return json(200, {
      count: parkingLots.length,
      parkingLots,
    });
  } catch (error) {
    console.error("listParkingLots failed", error);
    return serverError("Could not load parking lots");
  }
};
