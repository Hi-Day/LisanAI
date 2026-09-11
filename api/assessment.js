const {
  generateProbing, generateQuestions, improveQuestionSet, recommendAssessmentConfig,
  streamAlignRubricSet, streamGenerateQuestions, streamImproveQuestionSet, streamProbing, streamRecommendAssessmentConfig,
} = require("../server/assessment-service");
const { prepareProbingPayload, normalizeProbeResult } = require("../server/adaptive-probing");
const { getSessionUser, SESSION_COOKIE } = require("../server/auth-service");
const { ensureDatabase } = require("../server/bootstrap");
const { parseCookies, readJson, sendJson } = require("../server/http-utils");
const { applySecurityHeaders } = require("../server/security-headers");
const { authenticateApiKey } = require("../server/api-auth");
const { assertRateLimit } = require("../server/rate-limit");

function writeSse(res, data) { res.write(`data: ${JSON.stringify(data)}\n\n`); }

async function evaluateProbeBaseline(payload, auth) {
  const { evaluateWithHarness } = require("../server/harness/harness-evaluator");
  const question = payload.question || {};
  const source = payload.assessment || {};
  const assessment = {
    ...source,
    id: source.id || payload.assessmentId,
    questions: [question],
    criteria: source.criteria || payload.criteria || [],
    rubric: source.rubric || payload.rubric || "",
    outcomes: source.outcomes || payload.outcomes || payload.focus || "",
  };
  const result = await evaluateWithHarness({ ...payload, auth, assessment, answers: [String(payload.answer || "")], onProgress: null });
  const qs = result.questionScores?.[0] || {};
  return {
    score: Number.isFinite(Number(qs.score)) ? Number(qs.score) : null,
    evidence: Array.isArray(qs.evidence) ? qs.evidence : [],
    evaluationId: result.evaluationId || null,
    evaluationRunId: result.evaluationRunId || null,
  };
}

async function buildAdaptiveProbe(payload, auth, onChunk) {
  const adaptivePayload = prepareProbingPayload(payload);
  let baseline = null;
  if (payload.probing === true || payload.question?.probing === true) {
    try { baseline = await evaluateProbeBaseline(payload, auth); }
    catch (error) { console.warn("[adaptive-probing] baseline evaluation unavailable:", error.message); }
  }
  const enriched = {
    ...adaptivePayload,
    baselineScore: baseline?.score ?? null,
    baselineEvidence: baseline?.evidence || [],
    baselineEvaluationId: baseline?.evaluationId || null,
    baselineEvaluationRunId: baseline?.evaluationRunId || null,
  };
  const probing = onChunk ? await streamProbing(enriched, onChunk) : await generateProbing(enriched);
  return normalizeProbeResult(probing, enriched);
}

async function handleStreamingAction(req, res, auth, action, payload) {
  applySecurityHeaders(res);
  res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.write("retry: 2000\n\n");
  const onChunk = (text) => { if (text && res.writableEnded === false) writeSse(res, { type: "chunk", text }); };
  try {
    let result;
    if (action === "generate-questions") { result = await streamGenerateQuestions(payload, onChunk); writeSse(res, { type: "result", data: { questions: result } }); }
    else if (action === "align-rubric") { result = await streamAlignRubricSet(payload, onChunk); writeSse(res, { type: "result", data: { questions: result, aligned: true } }); }
    else if (action === "improve-questions") { result = await streamImproveQuestionSet(payload, onChunk); writeSse(res, { type: "result", data: { questions: result } }); }
    else if (action === "repair-pedagogical-grounding") {
      const { repairPedagogicalGrounding } = require("../server/pedagogical-repair");
      result = await repairPedagogicalGrounding(payload);
      writeSse(res, { type: "result", data: result });
    }
    else if (action === "recommend-assessment-config") { result = await streamRecommendAssessmentConfig(payload, onChunk); writeSse(res, { type: "result", data: { recommendation: result } }); }
    else if (action === "evaluate") {
      const { evaluateWithHarness } = require("../server/harness/harness-evaluator");
      const evaluation = await evaluateWithHarness({ ...payload, auth, onProgress: (text) => { if (res.writableEnded === false) writeSse(res, { type: "chunk", text }); } });
      writeSse(res, { type: "chunk", text: "Evaluasi selesai." });
      writeSse(res, { type: "result", data: { evaluation, harness: true } });
    } else if (action === "generate-probing") {
      writeSse(res, { type: "result", data: { probing: await buildAdaptiveProbe(payload, auth, onChunk) } });
    } else writeSse(res, { type: "error", message: "Action not found" });
  } catch (error) { console.error(error); writeSse(res, { type: "error", message: error.message || "Server error" }); }
  finally { res.end(); }
}

module.exports = async (req, res) => {
  try {
    await ensureDatabase();
    if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
    let auth = await getSessionUser(parseCookies(req)[SESSION_COOKIE]);
    let viaApiKey = false;
    if (!auth) {
      const apiAuth = await authenticateApiKey(req);
      if (apiAuth) { auth = { tenant: { id: apiAuth.tenantId, name: "API", plan: "api" }, user: { id: `apikey:${apiAuth.keyId}`, tenantId: apiAuth.tenantId, name: "API Key", role: "admin" } }; viaApiKey = true; }
    }
    if (!auth) return sendJson(res, 401, { error: "Unauthorized" });
    assertRateLimit(`assessment:${auth.user.id}`, { limit: 30, windowMs: 60_000 });
    if (!viaApiKey) { const { assertCsrfToken } = require("../server/auth-service"); try { assertCsrfToken(req, auth); } catch (e) { return sendJson(res, 403, { error: e.message }); } }
    const body = await readJson(req); const { action, payload, stream } = body;
    if (payload) { payload.tenantId = auth.tenant.id; payload.userId = auth.user.id; }
    if (stream === true) {
      if (action === "evaluate" && auth.user.role === "student") { const { assertCanSubmitAssessment } = require("../server/database"); try { await assertCanSubmitAssessment(auth.tenant.id, auth.user.id, payload.assessment.id); } catch (e) { return sendJson(res, e.status || 403, { error: e.message }); } }
      if (action !== "evaluate" && action !== "generate-probing" && !["admin", "teacher"].includes(auth.user.role)) return sendJson(res, 403, { error: "Forbidden" });
      return handleStreamingAction(req, res, auth, action, payload);
    }
    if (action === "evaluate") {
      if (auth.user.role === "student") { const { assertCanSubmitAssessment } = require("../server/database"); try { await assertCanSubmitAssessment(auth.tenant.id, auth.user.id, payload.assessment.id); } catch (e) { return sendJson(res, e.status || 403, { error: e.message }); } }
      const { evaluateWithHarness } = require("../server/harness/harness-evaluator");
      return sendJson(res, 200, { evaluation: await evaluateWithHarness({ ...payload, auth }), model: process.env.OPENROUTER_MODEL, harness: true });
    }
    if (action === "generate-probing") return sendJson(res, 200, { probing: await buildAdaptiveProbe(payload, auth, null), model: process.env.OPENROUTER_MODEL });
    if (!["admin", "teacher"].includes(auth.user.role)) return sendJson(res, 403, { error: "Forbidden" });
    if (action === "generate-questions") return sendJson(res, 200, { questions: await generateQuestions(payload), model: process.env.OPENROUTER_MODEL });
    if (action === "align-rubric") { const { calibrateRubricSet } = require("../server/assessment-service"); return sendJson(res, 200, { questions: await calibrateRubricSet(payload), model: process.env.OPENROUTER_MODEL, aligned: true }); }
    if (action === "improve-questions") return sendJson(res, 200, { questions: await improveQuestionSet(payload), model: process.env.OPENROUTER_MODEL });
    if (action === "repair-pedagogical-grounding") {
      const { repairPedagogicalGrounding } = require("../server/pedagogical-repair");
      return sendJson(res, 200, { ...(await repairPedagogicalGrounding(payload)), model: process.env.OPENROUTER_MODEL });
    }
    if (action === "recommend-assessment-config") return sendJson(res, 200, { recommendation: await recommendAssessmentConfig(payload), model: process.env.OPENROUTER_MODEL });
    return sendJson(res, 404, { error: "Action not found" });
  } catch (error) { console.error(error); return sendJson(res, error.status || 500, { error: error.message || "Server error" }); }
};
