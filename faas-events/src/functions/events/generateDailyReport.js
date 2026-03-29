const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const { ddb, ScanCommand, isLocalStage } = require("../../common/db");

const sqs = new SQSClient({});
const RESERVATIONS_TABLE = process.env.RESERVATIONS_TABLE;
const NOTIFICATION_QUEUE_URL = process.env.NOTIFICATION_QUEUE_URL;

exports.handler = async () => {
  const result = await ddb.send(
    new ScanCommand({
      TableName: RESERVATIONS_TABLE,
      ProjectionExpression: "reservationId, #status",
      ExpressionAttributeNames: {
        "#status": "status",
      },
    }),
  );

  const reservations = result.Items || [];

  const stats = {
    total: reservations.length,
    active: 0,
    cancelled: 0,
    expired: 0,
    other: 0,
  };

  for (const item of reservations) {
    const status = String(item.status || "").toLowerCase();
    if (status === "active") {
      stats.active += 1;
    } else if (status === "cancelled") {
      stats.cancelled += 1;
    } else if (status === "expired") {
      stats.expired += 1;
    } else {
      stats.other += 1;
    }
  }

  const reportMessage = {
    eventType: "report.daily_reservations",
    generatedAt: new Date().toISOString(),
    stats,
  };

  if (isLocalStage) {
    console.log("Local stage: skipping SQS publish", reportMessage);
  } else {
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: NOTIFICATION_QUEUE_URL,
        MessageBody: JSON.stringify(reportMessage),
      }),
    );
  }

  console.log("Daily reservation report generated", reportMessage);

  return reportMessage;
};
