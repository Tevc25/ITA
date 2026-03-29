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

  if (event?.requestContext?.authorizer?.userId) {
    return event.requestContext.authorizer.userId;
  }

  return null;
}

module.exports = {
  parseBody,
  extractBearerToken,
  getUserIdFromEvent,
};
