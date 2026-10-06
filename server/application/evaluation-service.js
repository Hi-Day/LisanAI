const { prepareProbingPayload, normalizeProbeResult } = require("../adaptive-probing");
const { generateProbing, streamProbing } = require("../assessment/probing-service");
const { evaluateWithHarness } = require("../harness/harness-evaluator");
const submissionService = require("./submission-service");
const { assessmentSnapshotHash, rubricHash, answersHash, hashObject } = require("../security/assessment-integrity");
const crypto = require("node:crypto");

const ACTIONS = ["evaluate", "generate-probing", "create-attempt"];

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
  if (process.env.HARNESS_PROVIDER !== "openrouter") {
    throw Object.assign(new Error("Asesor AI resmi belum tersedia. Assessment tidak dapat dinilai."), { status: 503, code: "OFFICIAL_EVALUATION_UNAVAILABLE" });
  }
  const attempt = await submissionService.getAssessmentAttempt(auth, payload.attemptId);
  if (attempt.assessment_id !== payload.assessmentId) {
    throw Object.assign(new Error("Attempt tidak cocok dengan assessment"), { status: 409, code: "ATTEMPT_ASSESSMENT_MISMATCH" });
  }
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
  const assessmentId = String(payload?.assessmentId || payload?.assessment?.id || "").trim();
  if (!assessmentId) throw Object.assign(new Error("assessmentId wajib"), { status: 400 });

  const attempt = await submissionService.beginAttemptEvaluation(auth, payload.attemptId, payload.answers || [], assessmentId);
  if (attempt.existingSubmission) return { ...attempt.existingSubmission, alreadyFinalized: true };

  const canonical = await submissionService.getCanonicalAssessmentForStudent(
    auth, assessmentId, payload?.classId || payload?.assessment?.deliveryClassId || null,
  );
  const assessment = canonical.assessment;
  const answers = Array.isArray(payload.answers)
    ? payload.answers.map((answer) => String(answer || ""))
    : [];

  if (answers.length !== assessment.questions.length) {
    throw Object.assign(
      new Error(`Jumlah jawaban (${answers.length}) tidak cocok dengan jumlah soal (${assessment.questions.length})`),
      { status: 400, code: "ANSWER_COUNT_MISMATCH" },
    );
  }

  const assessmentHash = assessmentSnapshotHash(assessment);
  const expectedAttempt = await submissionService.getAssessmentAttempt(auth, payload.attemptId);
  if (expectedAttempt.assessment_hash !== assessmentHash) {
    throw Object.assign(new Error("Assessment berubah setelah attempt dimulai"), { status: 409, code: "ASSESSMENT_SNAPSHOT_MISMATCH" });
  }

  const answerHash = answersHash(answers);
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

  // Official assessment is fail-closed: fallback/mock results are never final.
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
      evaluationHash: hashObject({
        evaluationId: result.evaluationId || null,
        evaluationRunId: result.evaluationRunId || null,
        finalScore: result.finalScore,
        criteria: result.criteria || [],
      }),
      attemptId: payload.attemptId,
    },
  };

  // Canonical persistence happens only on the server. The browser never gets
  // an opportunity to submit or alter the authoritative score.
  await submissionService.saveEvaluatedSubmission(auth, submission);
  await submissionService.finalizeAssessmentAttempt(auth, payload.attemptId, submission, {
    assessmentHash,
    rubricHash: expectedAttempt.rubric_hash,
    submissionHash: hashObject(submission),
  });

  return submission;
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
  if (action === "create-attempt") return { attempt: await createAttempt(payload, auth) };
  return { probing: await buildAdaptiveProbe(payload, auth) };
}

async function executeStreamingAction(action, payload, auth, onChunk) {
  if (action === "evaluate") return { evaluation: await evaluate(payload, auth, onChunk), harness: true };
  if (action === "create-attempt") return { attempt: await createAttempt(payload, auth) };
  return { probing: await buildAdaptiveProbe(payload, auth, onChunk) };
}

module.exports = { ACTIONS, assertCanEvaluate, buildAdaptiveProbe, executeAction, executeStreamingAction, isSupportedAction, createAttempt };
