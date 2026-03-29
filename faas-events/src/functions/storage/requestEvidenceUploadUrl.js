const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { ddb, GetCommand, isLocalStage } = require("../../common/db");
const { getUserIdFromEvent, parseBody } = require("../../common/http");
const { unauthorized, badRequest, notFound, json, serverError } = require("../../common/response");

const s3 = new S3Client({});

const RESERVATIONS_TABLE = process.env.RESERVATIONS_TABLE;
const EVIDENCE_BUCKET = process.env.EVIDENCE_BUCKET;

exports.handler = async (event) => {
  const userId = getUserIdFromEvent(event);
  if (!userId) {
    return unauthorized();
  }

  const reservationId = event?.pathParameters?.reservationId;
  if (!reservationId) {
    return badRequest("reservationId is required");
  }

  const body = parseBody(event);
  const contentType = String(body?.contentType || "image/jpeg").trim();

  try {
    const reservationResult = await ddb.send(
      new GetCommand({
        TableName: RESERVATIONS_TABLE,
        Key: { userId, reservationId },
      }),
    );

    const reservation = reservationResult.Item;
    if (!reservation) {
      return notFound("Reservation not found");
    }

    const objectKey = `reservations/${reservationId}/${Date.now()}-evidence`;

    if (isLocalStage) {
      const host = event?.headers?.host || event?.headers?.Host || "localhost:3010";
      const proto = event?.headers?.["x-forwarded-proto"] || "http";
      const uploadUrl = `${proto}://${host}/reservations/${reservationId}/evidence/local-upload`;

      return json(200, {
        uploadUrl,
        objectKey: `local/${objectKey}`,
        expiresInSeconds: 900,
        contentType,
      });
    }

    const command = new PutObjectCommand({
      Bucket: EVIDENCE_BUCKET,
      Key: objectKey,
      ContentType: contentType,
      Metadata: {
        reservationid: reservationId,
        userid: userId,
      },
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

    return json(200, {
      uploadUrl,
      objectKey,
      expiresInSeconds: 900,
      contentType,
    });
  } catch (error) {
    console.error("requestEvidenceUploadUrl failed", error);
    return serverError("Could not generate upload URL");
  }
};
