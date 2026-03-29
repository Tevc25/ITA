const { ddb, QueryCommand, UpdateCommand } = require("../../common/db");

const RESERVATIONS_TABLE = process.env.RESERVATIONS_TABLE;
const PARKING_LOTS_TABLE = process.env.PARKING_LOTS_TABLE;

exports.handler = async () => {
  const now = new Date().toISOString();
  let expiredCount = 0;

  const result = await ddb.send(
    new QueryCommand({
      TableName: RESERVATIONS_TABLE,
      IndexName: "status-index",
      KeyConditionExpression: "#status = :status",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": "active",
      },
    }),
  );

  const activeReservations = result.Items || [];

  for (const reservation of activeReservations) {
    if (!reservation.endTime || reservation.endTime > now) {
      continue;
    }

    try {
      await ddb.send(
        new UpdateCommand({
          TableName: RESERVATIONS_TABLE,
          Key: {
            userId: reservation.userId,
            reservationId: reservation.reservationId,
          },
          ConditionExpression: "#status = :active",
          UpdateExpression: "SET #status = :expired, updatedAt = :updatedAt",
          ExpressionAttributeNames: {
            "#status": "status",
          },
          ExpressionAttributeValues: {
            ":active": "active",
            ":expired": "expired",
            ":updatedAt": new Date().toISOString(),
          },
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

      expiredCount += 1;
    } catch (error) {
      if (error?.name !== "ConditionalCheckFailedException") {
        console.error("Failed to expire reservation", {
          reservationId: reservation.reservationId,
          error,
        });
      }
    }
  }

  console.log("Expire reservations cron finished", {
    activeChecked: activeReservations.length,
    expiredCount,
  });

  return {
    activeChecked: activeReservations.length,
    expiredCount,
  };
};
