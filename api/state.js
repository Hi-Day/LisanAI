// Lightweight read-only state endpoint used by the frontend (src/js/api.js).
// Created to match commit 4c8c6f2 which switched loadStateFromDatabase()
// from /api/database?action=state to GET /api/state without adding the handler.
const { getState } = require("../server/database");
const { ensureDatabase } = require("../server/bootstrap");
const { ensureShowcaseDemo } = require("../server/showcase-bootstrap");
const { sendJson } = require("../server/http-utils");
const { requireAuthenticatedRequest } = require("../server/http/request-security");

module.exports = async (req, res) => {
  try {
    await ensureDatabase();
    if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
    const security = await requireAuthenticatedRequest(req, res, { allowApiKey: false, csrf: false });
    if (!security) return;
    await ensureShowcaseDemo();
    return sendJson(res, 200, await getState(security.auth));
  } catch (error) {
    console.error(error);
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};
