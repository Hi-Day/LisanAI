// API key management endpoint (admin only).
// api/auth.js delegates /api/apikeys here; the frontend (src/js/api-keys.js)
// calls GET /api/apikeys and POST /api/apikeys with { action, payload }.
const { ensureDatabase } = require("../server/bootstrap");
const { readJson, sendJson } = require("../server/http-utils");
const { requireAuthenticatedRequest, requireRoles } = require("../server/http/request-security");
const { createApiKey, listApiKeys, revokeApiKey } = require("../server/api-key-service");

module.exports = async (req, res) => {
  try {
    await ensureDatabase();
    if (req.method !== "GET" && req.method !== "POST") {
      return sendJson(res, 405, { error: "Method not allowed" });
    }
    const security = await requireAuthenticatedRequest(req, res,
      req.method === "GET" ? { allowApiKey: false, csrf: false } : { allowApiKey: false });
    if (!security) return;
    if (!requireRoles(res, security.auth, ["admin"])) return;
    const tenantId = security.auth.tenant.id;

    if (req.method === "GET") {
      return sendJson(res, 200, { keys: await listApiKeys(tenantId) });
    }

    const { action, payload } = await readJson(req);
    if (action === "create") {
      const { rawKey, record } = await createApiKey(tenantId, {
        name: payload && payload.name,
        createdBy: security.auth.user.id,
      });
      return sendJson(res, 201, { key: rawKey, id: record.id, name: record.name, prefix: record.prefix });
    }
    if (action === "revoke") {
      await revokeApiKey(tenantId, payload && payload.keyId);
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 404, { error: "Action not found" });
  } catch (error) {
    console.error(error);
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};
