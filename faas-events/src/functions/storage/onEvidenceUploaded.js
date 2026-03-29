const { ddb, QueryCommand, UpdateCommand } = require("../../common/db");

const RESERVATIONS_TABLE = process.env.RESERVATIONS_TABLE;

function extractReservationId(key) {
  const match = /^reservations\/([^/]+)\//.exec(key);
  return match?.[1] || null;
}

exports.handler = async (event) => {
  const records = event?.Records || [];

  for (const record of records) {
    const objectKey = decodeURIComponent(record?.s3?.object?.key || "").replace(/\+/g, " ");
    const reservationId = extractReservationId(objectKey);

    if (!reservationId) {
      console.warn("Could not parse reservationId from object key", { objectKey });
      continue;
    }

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
      console.warn("Reservation for uploaded evidence was not found", { reservationId, objectKey });
      continue;
    }

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

    console.log("Evidence uploaded and reservation updated", {
      reservationId,
      objectKey,
      userId: reservation.userId,
    });
  }

  return {
    processed: records.length,
  };
};
