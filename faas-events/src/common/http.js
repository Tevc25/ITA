const { verifyToken } = require("./auth");

function parseBody(event) {
  if (!event || !event.body) {
    return {};
  }

  if (typeof event.body === "object") {
    return event.body;
  }

  try {
    return JSON.parse(event.body);
  } catch {
    return null;
  }
}

function normalizeHeaderMap(headers) {
  if (!headers) {
    return {};
  }

  return Object.entries(headers).reduce((acc, [key, value]) => {
    acc[key.toLowerCase()] = value;
    return acc;
  }, {});
}

function extractBearerToken(event) {
  const headers = normalizeHeaderMap(event?.headers);
  const raw = headers.authorization || "";

  if (!raw.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return raw.slice(7).trim();
}

function getUserIdFromEvent(event) {
  const lambdaContext = event?.requestContext?.authorizer?.lambda;
  if (lambdaContext?.userId) {
    return lambdaContext.userId;
  }

  if (lambdaContext?.principalId) {
    return lambdaContext.principalId;
  }

  if (event?.requestContext?.authorizer?.principalId) {
    return event.requestContext.authorizer.principalId;
  }

  if (event?.requestContext?.authorizer?.userId) {
    return event.requestContext.authorizer.userId;
  }

  const token = extractBearerToken(event);
  const claims = token ? verifyToken(token) : null;
  if (claims?.userId) {
    return claims.userId;
  }

  return null;
}

module.exports = {
  parseBody,
  extractBearerToken,
  getUserIdFromEvent,
};
