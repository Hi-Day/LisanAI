const { generateProbing, streamProbing } = require("../assessment-service");
const { prepareProbingPayload, normalizeProbeResult } = require("../adaptive-probing");
const { getSessionUser, SESSION_COOKIE, assertCsrfToken } = require("../auth-service");
const { ensureDatabase } = require("../bootstrap");
const { parseCookies, readJson, sendJson } = require("../http-utils");
const { applySecurityHeaders } = require("../security-headers");
const { authenticateApiKey } = require("../api-auth");
const { assertRateLimit } = require("../rate-limit");
const { assertCanSubmitAssessment } = require("../database");

function writeSse(res, data) { res.write(`data: ${JSON.stringify(data)}\n\n`); }

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
  applySecurityHeaders(res);
  res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.write("retry: 2000\n\n");
  const onChunk = (text) => { if (text && res.writableEnded === false) writeSse(res, { type: "chunk", text }); };
  try {
    let result;
    if (action === "evaluate") {
      const { evaluateWithHarness } = require("../harness/harness-evaluator");
      const evaluation = await evaluateWithHarness({ ...payload, auth, onProgress: (text) => { if (res.writableEnded === false) writeSse(res, { type: "chunk", text }); } });
      writeSse(res, { type: "chunk", text: "Evaluasi selesai." });
      writeSse(res, { type: "result", data: { evaluation, harness: true } });
    } else if (action === "generate-probing") {
      result = await buildAdaptiveProbe(payload, auth, onChunk);
      writeSse(res, { type: "result", data: { probing: result } });
    } else {
      writeSse(res, { type: "error", message: "Action not found" });
    }
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
      if (apiAuth) {
        auth = { tenant: { id: apiAuth.tenantId, name: "API", plan: "api" }, user: { id: `apikey:${apiAuth.keyId}`, tenantId: apiAuth.tenantId, name: "API Key", role: "admin" } };
        viaApiKey = true;
      }
    }
    if (!auth) return sendJson(res, 401, { error: "Unauthorized" });
    assertRateLimit(`evaluation:${auth.user.id}`, { limit: 30, windowMs: 60_000 });
    if (!viaApiKey) { try { assertCsrfToken(req, auth); } catch (e) { return sendJson(res, 403, { error: e.message }); } }
    const body = await readJson(req);
    const { action, payload, stream } = body;
    if (!["evaluate", "generate-probing"].includes(action)) return sendJson(res, 404, { error: "Action not found" });
    if (payload) { payload.tenantId = auth.tenant.id; payload.userId = auth.user.id; }

    if (action === "evaluate" && auth.user.role === "student") {
      try { await assertCanSubmitAssessment(auth.tenant.id, auth.user.id, payload.assessment.id); }
      catch (e) { return sendJson(res, e.status || 403, { error: e.message }); }
    }
    if (action === "generate-probing" && !["admin", "teacher", "student"].includes(auth.user.role)) return sendJson(res, 403, { error: "Forbidden" });

    if (stream === true) return handleStreamingAction(res, auth, action, payload);

    if (action === "evaluate") {
      const { evaluateWithHarness } = require("../harness/harness-evaluator");
      return sendJson(res, 200, { evaluation: await evaluateWithHarness({ ...payload, auth }), model: process.env.OPENROUTER_MODEL, harness: true });
    }
    return sendJson(res, 200, { probing: await buildAdaptiveProbe(payload, auth, null), model: process.env.OPENROUTER_MODEL });
  } catch (error) { console.error(error); return sendJson(res, error.status || 500, { error: error.message || "Server error" }); }
};
