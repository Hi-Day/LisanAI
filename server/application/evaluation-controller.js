const evaluationService = require("./evaluation-service");
const { ensureDatabase } = require("../bootstrap");
const { readJson, sendJson } = require("../http-utils");
const { requireAuthenticatedRequest, requireRoles } = require("../http/request-security");
const { beginStream, createChunkWriter, endStream, writeEvent } = require("../http/sse");

async function handleStreamingAction(res, auth, action, payload) {
  beginStream(res);
  const onChunk = createChunkWriter(res);
  try {
    if (!evaluationService.isSupportedAction(action)) {
      writeEvent(res, { type: "error", message: "Action not found" });
      return;
    }
    const result = await evaluationService.executeStreamingAction(action, payload, auth, onChunk);
    if (action === "evaluate") writeEvent(res, { type: "chunk", text: "Evaluasi selesai." });
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
      rateLimit: "evaluation",
      rateLimitOptions: { limit: 30, windowMs: 60_000 },
    });
    if (!security) return;
    const { auth } = security;
    if (!requireRoles(res, auth, ["admin", "teacher", "student"])) return;

    const body = await readJson(req);
    const { action, payload, stream } = body;
    if (!evaluationService.isSupportedAction(action)) {
      return sendJson(res, 404, { error: "Action not found" });
    }
    if (payload) {
      payload.tenantId = auth.tenant.id;
      payload.userId = auth.user.id;
    }

    try {
      await evaluationService.assertCanEvaluate(payload, auth);
    } catch (error) {
      return sendJson(res, error.status || 403, { error: error.message });
    }

    if (stream === true) return handleStreamingAction(res, auth, action, payload);

    const result = await evaluationService.executeAction(action, payload, auth);
    return sendJson(res, 200, { ...result, model: process.env.OPENROUTER_MODEL });
  } catch (error) {
    console.error(error);
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};
