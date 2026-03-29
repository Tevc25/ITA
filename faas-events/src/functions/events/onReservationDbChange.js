const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const { unmarshall } = require("@aws-sdk/util-dynamodb");

const sqs = new SQSClient({});
const NOTIFICATION_QUEUE_URL = process.env.NOTIFICATION_QUEUE_URL;

function resolveEventType(record) {
  const eventName = record?.eventName;
  const oldImage = record?.dynamodb?.OldImage ? unmarshall(record.dynamodb.OldImage) : null;
  const newImage = record?.dynamodb?.NewImage ? unmarshall(record.dynamodb.NewImage) : null;

  if (eventName === "INSERT") {
    return {
      type: "reservation.created",
      payload: newImage,
    };
  }

  if (eventName === "MODIFY" && oldImage?.status !== newImage?.status) {
    return {
      type: `reservation.${newImage?.status || "updated"}`,
      payload: newImage,
    };
  }

  if (eventName === "MODIFY" && oldImage?.evidenceStatus !== newImage?.evidenceStatus) {
    return {
      type: "reservation.evidence_uploaded",
      payload: newImage,
    };
  }

  return null;
}

exports.handler = async (event) => {
  const records = event?.Records || [];
  let published = 0;

  for (const record of records) {
    const mapped = resolveEventType(record);
    if (!mapped) {
      continue;
    }

    const message = {
      eventType: mapped.type,
      occurredAt: new Date().toISOString(),
      reservationId: mapped.payload?.reservationId,
      userId: mapped.payload?.userId,
      parkingLotId: mapped.payload?.parkingLotId,
      payload: mapped.payload,
    };

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: NOTIFICATION_QUEUE_URL,
        MessageBody: JSON.stringify(message),
      }),
    );

    published += 1;
  }

  return {
    processed: records.length,
    published,
  };
};
