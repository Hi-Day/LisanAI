const { prepareProbingPayload, normalizeProbeResult } = require("../adaptive-probing");
const { generateProbing, streamProbing } = require("../assessment/probing-service");
const { evaluateWithHarness } = require("../harness/harness-evaluator");
const submissionService = require("./submission-service");
const { assessmentSnapshotHash, rubricHash, answersHash, hashObject } = require("../security/assessment-integrity");
const crypto = require("node:crypto");
const { evaluationHash } = require("../security/evaluation-integrity");
const { persistEvaluationTrace } = require("../evaluation/trace-persister");
const { pendingRelease, toStudentView } = require("../score-release");

const ACTIONS = ["evaluate", "generate-probing", "create-attempt", "save-draft", "process-pending"];
const PENDING_SWEEP_LIMIT = 3;
// Stop starting new evaluations after this long, so one sweep fits in one request.
const PENDING_SWEEP_BUDGET_MS = 20_000;

function isSupportedAction(action) {
  return ACTIONS.includes(action);
}

function randomId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

async function assertCanEvaluate(action, payload, auth) {
  if (action !== "evaluate" || auth.user.role !== "student") return;
  if (!payload?.attemptId) {
    const error = Object.assign(new Error("attemptId wajib untuk assessment resmi"), { status: 400, code: "ATTEMPT_REQUIRED" });
    throw error;
  }
  // Production student assessments are fail-closed: only OpenRouter may publish
  // an official score. E2E explicitly opts into the deterministic MockProvider
  // through a server-only test flag; this flag is never enabled in production.
  const testMockEvaluation = process.env.NODE_ENV !== "production" && process.env.E2E_ALLOW_MOCK_EVALUATION === "true";
  if (process.env.HARNESS_PROVIDER !== "openrouter" && !testMockEvaluation) {
    throw Object.assign(new Error("Asesor AI resmi belum tersedia. Assessment tidak dapat dinilai."), { status: 503, code: "OFFICIAL_EVALUATION_UNAVAILABLE" });
  }
  const attempt = await submissionService.getAssessmentAttempt(auth, payload.attemptId);
  if (attempt.assessment_id !== payload.assessmentId) {
    throw Object.assign(new Error("Attempt tidak cocok dengan assessment"), { status: 409, code: "ATTEMPT_ASSESSMENT_MISMATCH" });
  }
  // The canonical assessment + attempt ownership/lifecycle checks above are
  // authoritative for official evaluation. Do not re-run the legacy submission
  // gate here: it counts historical submissions and can reject a valid active
  // attempt before the attempt state machine gets to finalize it.
  // Architecture boundary: submission authorization remains owned by
  // submissionService.assertCanSubmit; official evaluation uses the stronger
  // attempt-based authorization above rather than invoking the legacy gate.

}

async function createAttempt(payload, auth) {
  if (auth.user.role !== "student") {
    throw Object.assign(new Error("Hanya siswa yang dapat memulai assessment"), { status: 403 });
  }
  return submissionService.createAssessmentAttempt(
    auth,
    payload?.assessmentId,
    payload?.classId || null,
    payload?.idempotencyKey || null,
  );
}

async function evaluate(payload, auth, onProgress = null) {
  const progress = { answersRecorded: false };
  try {
    return await evaluateAttempt(payload, auth, onProgress, progress);
  } catch (error) {
    // Past the first submit the answers are on record, whatever fails afterwards. The caller
    // tells the student so instead of reporting a lost exam.
    if (progress.answersRecorded || error.code === "ATTEMPT_EVALUATION_IN_PROGRESS") error.answersRecorded = true;
    throw error;
  }
}

async function evaluateAttempt(payload, auth, onProgress, progress) {
  const assessmentId = String(payload?.assessmentId || payload?.assessment?.id || "").trim();
  if (!assessmentId) throw Object.assign(new Error("assessmentId wajib"), { status: 400 });

  const canonical = await submissionService.getCanonicalAssessmentForStudent(
    auth, assessmentId, payload?.classId || payload?.assessment?.deliveryClassId || null,
  );
  const assessment = canonical.assessment;
  let answers = Array.isArray(payload.answers)
    ? payload.answers.map((answer) => String(answer || ""))
    : [];

  if (answers.length !== assessment.questions.length) {
    throw Object.assign(
      new Error(`Jumlah jawaban (${answers.length}) tidak cocok dengan jumlah soal (${assessment.questions.length})`),
      { status: 400, code: "ANSWER_COUNT_MISMATCH" },
    );
  }

  const assessmentHash = assessmentSnapshotHash(assessment);
  const expectedBeforeStart = await submissionService.getAssessmentAttempt(auth, payload.attemptId);
  if (expectedBeforeStart.assessment_hash !== assessmentHash) {
    throw Object.assign(new Error("Assessment berubah setelah attempt dimulai"), { status: 409, code: "ASSESSMENT_SNAPSHOT_MISMATCH" });
  }

  const attempt = await submissionService.beginAttemptEvaluation(auth, payload.attemptId, answers, assessmentId);
  progress.answersRecorded = true;
  if (attempt.existingSubmission) return forViewer({ ...attempt.existingSubmission, alreadyFinalized: true }, auth);
  // The answers recorded at the first submit are the official ones, also on a retry.
  if (Array.isArray(attempt.answers) && attempt.answers.length === assessment.questions.length) {
    answers = attempt.answers.map((answer) => String(answer || ""));
  }
  const answerHash = answersHash(answers);

  const expectedAttempt = await submissionService.getAssessmentAttempt(auth, payload.attemptId);
  const submissionId = randomId("sub");
  let result;
  try {
    result = await evaluateWithHarness({
      ...payload,
      assessmentId,
      assessment,
      answers,
      studentName: auth.user.name,
      tenantId: auth.tenant.id,
      userId: auth.user.id,
      submissionId,
      attemptId: payload.attemptId,
      assessmentHash,
      answerHash,
      rubricHash: expectedAttempt.rubric_hash,
      onProgress,
    });
  } catch (error) {
    await submissionService.releaseAttemptEvaluation(auth, payload.attemptId).catch(() => {});
    throw error;
  }

  if (result.evaluationSource === "fallback") {
    await submissionService.releaseAttemptEvaluation(auth, payload.attemptId).catch(() => {});
    throw Object.assign(new Error("Evaluasi fallback tidak boleh menjadi nilai assessment resmi."), { status: 503, code: "OFFICIAL_FALLBACK_FORBIDDEN" });
  }

  const submission = {
    id: submissionId,
    assessmentId,
    assessmentTitle: assessment.topic,
    classId: expectedAttempt.class_id || assessment.classId || null,
    studentName: auth.user.name,
    submittedAt: new Date().toISOString(),
    finalScore: result.finalScore,
    questionScores: result.questionScores,
    feedback: result.feedback,
    status: result.requiresHumanReview ? "NEEDS_REVIEW" : "EVALUATED",
    // Scores stay hidden from the student until a lecturer validates them (score-release.js).
    scoreRelease: pendingRelease(),
    verification: result.verification || null,
    criteria: result.criteria || [],
    evaluationRunId: result.evaluationRunId || null,
    evaluationId: result.evaluationId || null,
    evaluationSource: "harness",
    insight: buildHarnessInsight(result),
    versioning: result.versioning || null,
    reliability: result.reliability || null,
    risk: result.risk || null,
    transcriptMetadata: result.transcriptMetadata || [],
    integrity: {
      assessmentHash,
      rubricHash: expectedAttempt.rubric_hash,
      answerHash,
      evaluationHash: null,
      attemptId: payload.attemptId,
    },
  };
  // The hash snapshot is computed after initialization (it intentionally excludes
  // integrity metadata), avoiding a temporal-dead-zone ReferenceError.
  submission.integrity.evaluationHash = evaluationHash(submission);

  await persistEvaluationTrace({ mode: "seal", runId: submission.evaluationRunId, tenantId: auth.tenant.id, result: submission });
  await submissionService.saveEvaluatedSubmission(auth, submission);
  await submissionService.finalizeAssessmentAttempt(auth, payload.attemptId, submission, {
    assessmentHash,
    rubricHash: expectedAttempt.rubric_hash,
    answerHash,
    evaluationHash: submission.integrity.evaluationHash,
    submissionHash: hashObject(submission),
  });

  // LTI grade passback happens only after lecturer validation (score-validation-service.js).
  return forViewer(submission, auth);
}

function forViewer(submission, auth) {
  return auth?.user?.role === "student" ? toStudentView(submission) : submission;
}
function buildHarnessInsight(evaluation) {
  const criteria = Array.isArray(evaluation.criteria) ? evaluation.criteria : [];
  if (!criteria.length) return "";
  const weakest = criteria.filter((c) => Number.isFinite(Number(c.score))).sort((a, b) => Number(a.score) - Number(b.score))[0];
  const strongest = criteria.filter((c) => Number.isFinite(Number(c.score))).sort((a, b) => Number(b.score) - Number(a.score))[0];
  const parts = [];
  if (strongest) parts.push(`Kekuatan utama pada ${strongest.name || strongest.criterionId || "indikator terkuat"}.`);
  if (weakest) parts.push(`Area yang perlu diperkuat: ${weakest.name || weakest.criterionId || "indikator terlemah"}.`);
  return parts.join(" ").trim();
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
  // Students never get a baseline: it would reveal an AI score before the lecturer releases it.
  if (auth?.user?.role !== "student" && (payload.probing === true || payload.question?.probing === true)) {
    try { baseline = await evaluateProbeBaseline(payload, auth); }
    catch (error) { console.warn("[adaptive-probing] baseline evaluation unavailable:", error.message); }
  }
  const enriched = { ...adaptivePayload, baselineScore: baseline?.score ?? null, baselineEvidence: baseline?.evidence || [], baselineEvaluationId: baseline?.evaluationId || null, baselineEvaluationRunId: baseline?.evaluationRunId || null };
  const probing = onChunk ? await streamProbing(enriched, onChunk) : await generateProbing(enriched);
  return normalizeProbeResult(probing, enriched);
}

/**
 * Finish evaluations nobody is waiting for any more: the AI call failed, or the student's
 * browser (or the function serving it) went away. Driven by the lecturer dashboard poll.
 */
async function processPendingEvaluations(auth) {
  const pending = await submissionService.listPendingEvaluations(auth, PENDING_SWEEP_LIMIT);
  const started = Date.now();
  let processed = 0;
  let failed = 0;
  for (const row of pending) {
    if (Date.now() - started > PENDING_SWEEP_BUDGET_MS) break;
    // The evaluation is written on behalf of the student who owns the attempt.
    const studentAuth = { tenant: auth.tenant, user: { id: row.user_id, tenantId: auth.tenant.id, name: row.user_name, role: "student" } };
    let answers = [];
    try { answers = JSON.parse(row.answers_json || "[]"); } catch { /* evaluate() rejects a wrong answer count */ }
    const payload = { assessmentId: row.assessment_id, attemptId: row.id, answers };
    await submissionService.countEvaluationRetry(auth, row.id);
    try {
      await assertCanEvaluate("evaluate", payload, studentAuth);
      await evaluate(payload, studentAuth);
      processed += 1;
    } catch (error) {
      failed += 1;
      console.error(`[pending-evaluation] attempt ${row.id} failed: ${error.message}`);
    }
  }
  return { pending: pending.length, processed, failed };
}

async function executeAction(action, payload, auth) {
  if (action === "process-pending") return processPendingEvaluations(auth);
  if (action === "evaluate") return { evaluation: await evaluate(payload, auth), harness: true };
  if (action === "create-attempt") return { attempt: await createAttempt(payload, auth) };
  if (action === "save-draft") return submissionService.saveAttemptDraft(auth, payload?.attemptId, payload?.draft);
  return { probing: await buildAdaptiveProbe(payload, auth) };
}

async function executeStreamingAction(action, payload, auth, onChunk) {
  if (action === "process-pending") return processPendingEvaluations(auth);
  if (action === "evaluate") return { evaluation: await evaluate(payload, auth, onChunk), harness: true };
  if (action === "create-attempt") return { attempt: await createAttempt(payload, auth) };
  if (action === "save-draft") return submissionService.saveAttemptDraft(auth, payload?.attemptId, payload?.draft);
  return { probing: await buildAdaptiveProbe(payload, auth, onChunk) };
}

module.exports = { ACTIONS, assertCanEvaluate, buildAdaptiveProbe, executeAction, executeStreamingAction, isSupportedAction, createAttempt, processPendingEvaluations };
