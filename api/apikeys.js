const { getSessionUser, SESSION_COOKIE } = require("../server/auth-service");
const { ensureDatabase } = require("../server/bootstrap");
const { parseCookies, readJson, sendJson } = require("../server/http-utils");
const { createApiKey, listApiKeys, revokeApiKey } = require("../server/api-key-service");

module.exports = async (req, res) => {
  try {
    await ensureDatabase();

    const auth = await getSessionUser(parseCookies(req)[SESSION_COOKIE]);
    if (!auth) return sendJson(res, 401, { error: "Unauthorized" });

    // Only admins can manage API keys.
    if (auth.user.role !== "admin") {
      return sendJson(res, 403, { error: "Forbidden" });
    }

    if (req.method === "GET") {
      const keys = await listApiKeys(auth.tenant.id);
      return sendJson(res, 200, { keys });
    }

    if (req.method === "POST") {
      const { assertCsrfToken } = require("../server/auth-service");
      try {
        assertCsrfToken(req, auth);
      } catch (csrfError) {
        return sendJson(res, 403, { error: csrfError.message });
      }

      const body = await readJson(req);
      const { action, payload } = body;

      if (action === "create") {
        const { rawKey, record } = await createApiKey(auth.tenant.id, {
          name: payload?.name,
          createdBy: auth.user.id,
        });
        return sendJson(res, 201, {
          key: rawKey, // shown only once
          keyId: record.id,
          name: record.name,
          prefix: record.prefix,
        });
      }

      if (action === "revoke") {
        await revokeApiKey(auth.tenant.id, payload?.keyId);
        return sendJson(res, 200, { ok: true });
      }

      return sendJson(res, 404, { error: "Action not found" });
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};