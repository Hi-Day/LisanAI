const { getSessionUser, SESSION_COOKIE, assertCsrfToken } = require("../auth-service");
const { parseCookies, sendJson } = require("./../http-utils");
const { authenticateApiKey } = require("../api-auth");
const { resolveRateLimiter } = require("../rate-limit");

async function authenticateRequest(req) {
  let auth = await getSessionUser(parseCookies(req)[SESSION_COOKIE]);
  let viaApiKey = false;

  if (!auth) {
    const apiAuth = await authenticateApiKey(req);
    if (apiAuth) {
      auth = {
        tenant: { id: apiAuth.tenantId, name: "API", plan: "api" },
        user: {
          id: `apikey:${apiAuth.keyId}`,
          tenantId: apiAuth.tenantId,
          name: "API Key",
          role: "admin",
        },
      };
      viaApiKey = true;
    }
  }

  return { auth, viaApiKey };
}

async function requireAuthenticatedRequest(req, res, options = {}) {
  const { auth, viaApiKey } = await authenticateRequest(req);
  if (!auth) {
    sendJson(res, 401, { error: "Unauthorized" });
    return null;
  }

  if (options.rateLimit) {
    const limiter = resolveRateLimiter();
    await limiter(`request:${options.rateLimit}:${auth.user.id}`, options.rateLimitOptions || { limit: 30, windowMs: 60_000 });
  }

  if (!viaApiKey && options.csrf !== false) {
    try {
      assertCsrfToken(req, auth);
    } catch (error) {
      sendJson(res, 403, { error: error.message });
      return null;
    }
  }

  return { auth, viaApiKey };
}

function requireRoles(res, auth, roles) {
  if (!roles.includes(auth.user.role)) {
    sendJson(res, 403, { error: "Forbidden" });
    return false;
  }
  return true;
}

module.exports = {
  authenticateRequest,
  requireAuthenticatedRequest,
  requireRoles,
};
