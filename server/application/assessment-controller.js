const assessmentService = require("./assessment-service");
const { ensureDatabase } = require("../bootstrap");
const { readJson, sendJson } = require("../http-utils");
const { requireAuthenticatedRequest, requireRoles } = require("../http/request-security");
const { beginStream, createChunkWriter, endStream, writeEvent } = require("../http/sse-writer");

async function handleStreamingAction(res, action, payload) {
  beginStream(res);
  const onChunk = createChunkWriter(res);
  try {
    if (!assessmentService.isSupportedAction(action)) {
      writeEvent(res, { type: "error", message: "Action not found" });
      return;
    }
    const result = await assessmentService.executeStreamingAction(action, payload, onChunk);
    writeEvent(res, { type: "result", data: result });
  } catch (error) {
    console.error(error);
    writeEvent(res, { type: "error", message: error.message || "Server error" });
  } finally {
    endStream(res);
  }
}

module.exports = async (req, res) => {
  try {
    await ensureDatabase();
    if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
    const security = await requireAuthenticatedRequest(req, res, {
      rateLimit: "assessment",
      rateLimitOptions: { limit: 30, windowMs: 60_000 },
    });
    if (!security) return;
    const { auth } = security;
    if (!requireRoles(res, auth, ["admin", "teacher"])) return;

    const body = await readJson(req);
    const { action, payload, stream } = body;
    if (payload) {
      payload.tenantId = auth.tenant.id;
      payload.userId = auth.user.id;
    }
    if (!assessmentService.isSupportedAction(action)) {
      return sendJson(res, 404, { error: "Action not found" });
    }
    if (stream === true) return handleStreamingAction(res, action, payload);

    const result = await assessmentService.executeAction(action, payload);
    return sendJson(res, 200, { ...result, model: process.env.OPENROUTER_MODEL });
  } catch (error) {
    console.error(error);
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};
