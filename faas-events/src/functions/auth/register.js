const { v4: uuidv4 } = require("uuid");
const { ddb, PutCommand, QueryCommand } = require("../../common/db");
const { hashPassword, signToken } = require("../../common/auth");
const { parseBody } = require("../../common/http");
const { badRequest, conflict, created, serverError } = require("../../common/response");

const USERS_TABLE = process.env.USERS_TABLE;

exports.handler = async (event) => {
  const body = parseBody(event);
  if (!body) {
    return badRequest("Invalid JSON body");
  }

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!name || !email || !password) {
    return badRequest("name, email and password are required");
  }

  if (password.length < 8) {
    return badRequest("password must contain at least 8 characters");
  }

  try {
    const existing = await ddb.send(
      new QueryCommand({
        TableName: USERS_TABLE,
        IndexName: "email-index",
        KeyConditionExpression: "#email = :email",
        ExpressionAttributeNames: { "#email": "email" },
        ExpressionAttributeValues: { ":email": email },
        Limit: 1,
      }),
    );

    if ((existing.Items || []).length > 0) {
      return conflict("User with this email already exists");
    }

    const userId = uuidv4();
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();

    await ddb.send(
      new PutCommand({
        TableName: USERS_TABLE,
        Item: {
          userId,
          name,
          email,
          passwordHash,
          role: "user",
          createdAt: now,
          updatedAt: now,
        },
      }),
    );

    const token = signToken({ userId, email, role: "user" });

    return created({
      userId,
      name,
      email,
      token,
    });
  } catch (error) {
    console.error("register failed", error);
    return serverError("Could not register user");
  }
};
