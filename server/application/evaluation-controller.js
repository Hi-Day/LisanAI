const { prepareProbingPayload, normalizeProbeResult } = require("../adaptive-probing");
const { generateProbing, streamProbing } = require("../assessment/probing-service");
const { ensureDatabase } = require("../bootstrap");
const { readJson, sendJson } = require("../http-utils");
const { requireAuthenticatedRequest, requireRoles } = require("../http/request-security");
const { beginStream, createChunkWriter, endStream, writeEvent } = require("../http/sse");
const { assertCanSubmitAssessment } = require("../database");

async function evaluateProbeBaseline(payload, auth) {
  const { evaluateWithHarness } = require("../harness/harness-evaluator");
  const question = payload.question || {};
  const source = payload.assessment || {};
  const assessment = { ...source, id: source.id || payload.assessmentId, questions: [question], criteria: source.criteria || payload.criteria || [], rubric: source.rubric || payload.rubric || "", outcomes: source.outcomes || payload.outcomes || payload.focus || "" };
  const result = await evaluateWithHarness({ ...payload, auth, assessment, answers: [String(payload.answer || "")], onProgress: null });
  const qs = result.questionScores?.[0] || {};
  return { score: Number.isFinite(Number(qs.score)) ? Number(qs.score) : null, evidence: Array.isArray(qs.evidence) ? qs.evidence : [], evaluationId: result.evaluationId || null, evaluationRunId: result.evaluationRunId || null };
}

async function buildAdaptiveProbe(payload, auth, onChunk) {
  const adaptivePayload = prepareProbingPayload(payload);
  let baseline = null;
  if (payload.probing === true || payload.question?.probing === true) {
    try { baseline = await evaluateProbeBaseline(payload, auth); }
    catch (error) { console.warn("[adaptive-probing] baseline evaluation unavailable:", error.message); }
  }
  const enriched = { ...adaptivePayload, baselineScore: baseline?.score ?? null, baselineEvidence: baseline?.evidence || [], baselineEvaluationId: baseline?.evaluationId || null, baselineEvaluationRunId: baseline?.evaluationRunId || null };
  const probing = onChunk ? await streamProbing(enriched, onChunk) : await generateProbing(enriched);
  return normalizeProbeResult(probing, enriched);
}

async function handleStreamingAction(res, auth, action, payload) {
  beginStream(res);
  const onChunk = createChunkWriter(res);
  try {
    if (action === "evaluate") {
      const { evaluateWithHarness } = require("../harness/harness-evaluator");
      const evaluation = await evaluateWithHarness({ ...payload, auth, onProgress: onChunk });
      writeEvent(res, { type: "chunk", text: "Evaluasi selesai." });
      writeEvent(res, { type: "result", data: { evaluation, harness: true } });
    } else if (action === "generate-probing") {
      const result = await buildAdaptiveProbe(payload, auth, onChunk);
      writeEvent(res, { type: "result", data: { probing: result } });
    } else {
      writeEvent(res, { type: "error", message: "Action not found" });
    }
  } catch (error) { console.error(error); writeEvent(res, { type: "error", message: error.message || "Server error" }); }
  finally { endStream(res); }
}

module.exports = async (req, res) => {
  try {
    await ensureDatabase();
    if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
    const security = await requireAuthenticatedRequest(req, res, { rateLimit: "evaluation", rateLimitOptions: { limit: 30, windowMs: 60_000 } });
    if (!security) return;
    const { auth } = security;
    if (!requireRoles(res, auth, ["admin", "teacher", "student"])) return;
    const body = await readJson(req);
    const { action, payload, stream } = body;
    if (!["evaluate", "generate-probing"].includes(action)) return sendJson(res, 404, { error: "Action not found" });
    if (payload) { payload.tenantId = auth.tenant.id; payload.userId = auth.user.id; }

    if (action === "evaluate" && auth.user.role === "student") {
      try { await assertCanSubmitAssessment(auth.tenant.id, auth.user.id, payload.assessment.id); }
      catch (e) { return sendJson(res, e.status || 403, { error: e.message }); }
    }

    if (stream === true) return handleStreamingAction(res, auth, action, payload);

    if (action === "evaluate") {
      const { evaluateWithHarness } = require("../harness/harness-evaluator");
      return sendJson(res, 200, { evaluation: await evaluateWithHarness({ ...payload, auth }), model: process.env.OPENROUTER_MODEL, harness: true });
    }
    return sendJson(res, 200, { probing: await buildAdaptiveProbe(payload, auth, null), model: process.env.OPENROUTER_MODEL });
  } catch (error) { console.error(error); return sendJson(res, error.status || 500, { error: error.message || "Server error" }); }
};
