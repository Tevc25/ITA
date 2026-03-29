const { ddb, QueryCommand } = require("../../common/db");
const { getUserIdFromEvent } = require("../../common/http");
const { unauthorized, json, serverError } = require("../../common/response");

const RESERVATIONS_TABLE = process.env.RESERVATIONS_TABLE;

exports.handler = async (event) => {
  const userId = getUserIdFromEvent(event);
  if (!userId) {
    return unauthorized();
  }

  const statusFilter = String(event?.queryStringParameters?.status || "").trim().toLowerCase();

  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: RESERVATIONS_TABLE,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
      }),
    );

    let reservations = result.Items || [];

    if (statusFilter) {
      reservations = reservations.filter((item) => String(item.status || "").toLowerCase() === statusFilter);
    }

    reservations.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    return json(200, {
      count: reservations.length,
      reservations,
    });
  } catch (error) {
    console.error("listUserReservations failed", error);
    return serverError("Could not list reservations");
  }
};
