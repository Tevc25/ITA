const { verifyToken } = require("../../common/auth");

exports.handler = async (event) => {
  const tokenSource = event?.identitySource?.[0] || "";
  const token = tokenSource.toLowerCase().startsWith("bearer ")
    ? tokenSource.slice(7).trim()
    : tokenSource;

  if (!token) {
    return { isAuthorized: false };
  }

  const claims = verifyToken(token);
  if (!claims?.userId) {
    return { isAuthorized: false };
  }

  return {
    isAuthorized: true,
    principalId: claims.userId,
    context: {
      principalId: claims.userId,
      userId: claims.userId,
      email: claims.email,
      role: claims.role || "user",
    },
  };
};
