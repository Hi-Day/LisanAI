const { prepareProbingPayload, normalizeProbeResult } = require("../adaptive-probing");
const { generateProbing, streamProbing } = require("../assessment/probing-service");
const { evaluateWithHarness } = require("../harness/harness-evaluator");
const submissionService = require("./submission-service");

const ACTIONS = ["evaluate", "generate-probing"];

function isSupportedAction(action) {
  return ACTIONS.includes(action);
}

async function assertCanEvaluate(action, payload, auth) {
  if (action !== "evaluate" || auth.user.role !== "student") return;
  await submissionService.assertCanSubmit(auth, payload.assessment.id);
}

async function evaluate(payload, auth, onProgress = null) {
  return evaluateWithHarness({ ...payload, auth, onProgress });
}

async function evaluateProbeBaseline(payload, auth) {
  const question = payload.question || {};
  const source = payload.assessment || {};
  const assessment = { ...source, id: source.id || payload.assessmentId, questions: [question], criteria: source.criteria || payload.criteria || [], rubric: source.rubric || payload.rubric || "", outcomes: source.outcomes || payload.outcomes || payload.focus || "" };
  const result = await evaluateWithHarness({ ...payload, auth, assessment, answers: [String(payload.answer || "")], onProgress: null });
  const qs = result.questionScores?.[0] || {};
  return { score: Number.isFinite(Number(qs.score)) ? Number(qs.score) : null, evidence: Array.isArray(qs.evidence) ? qs.evidence : [], evaluationId: result.evaluationId || null, evaluationRunId: result.evaluationRunId || null };
}

async function buildAdaptiveProbe(payload, auth, onChunk = null) {
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

async function executeAction(action, payload, auth) {
  if (action === "evaluate") return { evaluation: await evaluate(payload, auth), harness: true };
  return { probing: await buildAdaptiveProbe(payload, auth) };
}

async function executeStreamingAction(action, payload, auth, onChunk) {
  if (action === "evaluate") return { evaluation: await evaluate(payload, auth, onChunk), harness: true };
  return { probing: await buildAdaptiveProbe(payload, auth, onChunk) };
}

module.exports = { ACTIONS, assertCanEvaluate, buildAdaptiveProbe, executeAction, executeStreamingAction, isSupportedAction };
