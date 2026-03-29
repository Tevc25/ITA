const { ddb, GetCommand } = require("../../common/db");
const { getUserIdFromEvent } = require("../../common/http");
const { unauthorized, notFound, json, serverError } = require("../../common/response");

const USERS_TABLE = process.env.USERS_TABLE;

exports.handler = async (event) => {
  const userId = getUserIdFromEvent(event);
  if (!userId) {
    return unauthorized();
  }

  try {
    const result = await ddb.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { userId },
      }),
    );

    const user = result.Item;
    if (!user) {
      return notFound("User not found");
    }

    return json(200, {
      userId: user.userId,
      name: user.name,
      email: user.email,
      role: user.role || "user",
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error("me failed", error);
    return serverError("Could not load profile");
  }
};
