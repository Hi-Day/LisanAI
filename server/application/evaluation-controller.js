const evaluationService = require("./evaluation-service");
const { ensureDatabase } = require("../bootstrap");
const { readJson, sendJson } = require("../http-utils");
const { requireAuthenticatedRequest, requireRoles } = require("../http/request-security");
const { beginStream, createChunkWriter, endStream, writeEvent } = require("../http/sse");

// Once the answers are on record the student needs to know that, not the provider's error text.
const ANSWERS_RECORDED_MESSAGE = "Jawaban Anda sudah diterima. Penilaian AI belum selesai dan akan diproses ulang.";

function errorBody(error) {
  if (error.answersRecorded === true) return { message: ANSWERS_RECORDED_MESSAGE, answersRecorded: true };
  return { message: error.message || "Server error", answersRecorded: false };
}

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
    writeEvent(res, { type: "error", ...errorBody(error) });
  } finally {
    endStream(res);
  }
}

module.exports = async (req, res) => {
  try {
    await ensureDatabase();
    const security = await requireAuthenticatedRequest(req, res, {
      rateLimit: "evaluation",
      rateLimitOptions: { limit: 60, windowMs: 60_000 },
    });
    if (!security) return;
    const { auth } = security;
    if (!requireRoles(res, auth, ["admin", "teacher", "student"])) return;

    if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

    const body = await readJson(req);
    const { action, payload, stream } = body;

    if (!evaluationService.isSupportedAction(action)) return sendJson(res, 404, { error: "Action not found" });
    if (payload) {
      payload.tenantId = auth.tenant.id;
      payload.userId = auth.user.id;
    }

    try {
      await evaluationService.assertCanEvaluate(action, payload, auth);
    } catch (error) {
      return sendJson(res, error.status || 403, { error: error.message });
    }

    if (stream === true) return handleStreamingAction(res, auth, action, payload);

    const result = await evaluationService.executeAction(action, payload, auth);
    return sendJson(res, 200, { ...result, model: process.env.OPENROUTER_MODEL });
  } catch (error) {
    console.error(error);
    const { message, answersRecorded } = errorBody(error);
    return sendJson(res, error.status || 500, { error: message, answersRecorded });
  }
};
