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
    const security = await requireAuthenticatedRequest(req, res, {
      rateLimit: "evaluation",
      rateLimitOptions: { limit: 60, windowMs: 60_000 },
    });
    if (!security) return;
    const { auth } = security;
    if (!requireRoles(res, auth, ["admin", "teacher", "student"])) return;

    // Probing gate has its own CRUD contract but shares this Vercel boundary.
    // GET is used by teacher polling/status checks; POST is used to create/decide.
    if (req.method === "GET") {
      const params = new URL(req.url || "", "http://localhost").searchParams;
      const action = params.get("action");
      const probingGate = require("../probing-gate");
      if (action === "pending") {
        const probes = await probingGate.listPendingForTeacher(auth);
        return sendJson(res, 200, { probes });
      }
      if (action === "status") {
        const id = String(params.get("id") || "").trim();
        if (!id) return sendJson(res, 400, { error: "Probe id is required" });
        const probe = await probingGate.getProbeForStudent(auth, id);
        return sendJson(res, 200, { probe });
      }
      return sendJson(res, 404, { error: "Probing action not found" });
    }

    if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

    const body = await readJson(req);
    const { action, payload, stream } = body;

    if (action === "create" || action === "decide") {
      const probingGate = require("../probing-gate");
      if (action === "create") {
        const probe = await probingGate.createProbe(auth, payload || {});
        return sendJson(res, 200, { probe });
      }
      const probe = await probingGate.decideProbe(
        auth,
        payload?.id,
        payload?.decision,
        payload?.editedPrompt,
        payload?.note,
      );
      return sendJson(res, 200, { probe });
    }
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
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};
