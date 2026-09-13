const { ensureDatabase } = require("../bootstrap");
const { sendJson } = require("../http-utils");
const { authenticateRequest, requireRoles } = require("../http/request-security");
const { getObservabilitySnapshot } = require("../observability-service");

module.exports = async (req, res) => {
  try {
    await ensureDatabase();
    if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });

    const { auth } = await authenticateRequest(req, { allowApiKey: false });
    if (!auth) return sendJson(res, 401, { error: "Unauthorized" });
    if (!requireRoles(res, auth, ["admin"])) return;

    const url = new URL(req.url, `http://${req.headers.host}`);
    const data = await getObservabilitySnapshot(auth.tenant.id, {
      range: url.searchParams.get("range") || "24h",
    });
    return sendJson(res, 200, data);
  } catch (error) {
    console.error("Observability API Error:", error);
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};
