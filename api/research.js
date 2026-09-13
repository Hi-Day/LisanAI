// Research metrics endpoint (admin only).
// Frontend (src/js/research.js) and e2e call GET /api/research?action=metrics.
// Previously api/admin.js delegated to a non-existent api-internal/research.
const { compareAiVsHuman } = require("../server/evaluation/research");
const { ensureDatabase } = require("../server/bootstrap");
const { sendJson } = require("../server/http-utils");
const { requireAuthenticatedRequest, requireRoles } = require("../server/http/request-security");

module.exports = async (req, res) => {
  try {
    await ensureDatabase();
    if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
    const security = await requireAuthenticatedRequest(req, res, { allowApiKey: false, csrf: false });
    if (!security) return;
    if (!requireRoles(res, security.auth, ["admin"])) return;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const action = url.searchParams.get("action");
    if (action === "metrics") {
      const assessmentId = url.searchParams.get("assessmentId") || null;
      return sendJson(res, 200, await compareAiVsHuman(assessmentId, security.auth.tenant.id));
    }
    return sendJson(res, 404, { error: "Action not found" });
  } catch (error) {
    console.error(error);
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};
