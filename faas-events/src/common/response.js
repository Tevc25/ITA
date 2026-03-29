const defaultHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

function json(statusCode, payload) {
  return {
    statusCode,
    headers: defaultHeaders,
    body: JSON.stringify(payload),
  };
}

function created(payload) {
  return json(201, payload);
}

function badRequest(message, details) {
  return json(400, {
    error: "bad_request",
    message,
    details,
  });
}

function unauthorized(message = "Unauthorized") {
  return json(401, {
    error: "unauthorized",
    message,
  });
}

function notFound(message = "Resource not found") {
  return json(404, {
    error: "not_found",
    message,
  });
}

function conflict(message = "Conflict") {
  return json(409, {
    error: "conflict",
    message,
  });
}

function serverError(message = "Internal server error") {
  return json(500, {
    error: "internal_error",
    message,
  });
}

module.exports = {
  json,
  created,
  badRequest,
  unauthorized,
  notFound,
  conflict,
  serverError,
};
