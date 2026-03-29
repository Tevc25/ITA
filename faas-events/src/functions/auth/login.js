const { ddb, QueryCommand } = require("../../common/db");
const { comparePassword, signToken } = require("../../common/auth");
const { parseBody } = require("../../common/http");
const { badRequest, unauthorized, json, serverError } = require("../../common/response");

const USERS_TABLE = process.env.USERS_TABLE;

exports.handler = async (event) => {
  const body = parseBody(event);
  if (!body) {
    return badRequest("Invalid JSON body");
  }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!email || !password) {
    return badRequest("email and password are required");
  }

  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: USERS_TABLE,
        IndexName: "email-index",
        KeyConditionExpression: "#email = :email",
        ExpressionAttributeNames: { "#email": "email" },
        ExpressionAttributeValues: { ":email": email },
        Limit: 1,
      }),
    );

    const user = result.Items?.[0];
    if (!user) {
      return unauthorized("Invalid email or password");
    }

    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) {
      return unauthorized("Invalid email or password");
    }

    const token = signToken({
      userId: user.userId,
      email: user.email,
      role: user.role || "user",
    });

    return json(200, {
      token,
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role || "user",
      },
    });
  } catch (error) {
    console.error("login failed", error);
    return serverError("Could not login");
  }
};
