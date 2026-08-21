const { resolveApiKey } = require("./api-key-service");

/**
 * Extract a Bearer token from the Authorization header.
 * @returns {string|null}
 */
function extractBearerToken(req) {
  const header = req.headers?.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Authenticate a request using an API key (Bearer token).
 * Returns { tenantId, keyId } or null if not authenticated via API key.
 */
async function authenticateApiKey(req) {
  const token = extractBearerToken(req);
  if (!token) return null;
  return resolveApiKey(token);
}

module.exports = {
  extractBearerToken,
  authenticateApiKey,
};