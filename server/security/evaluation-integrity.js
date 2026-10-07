const { hashObject } = require("./assessment-integrity");

function evaluationSnapshot(result = {}) {
  return {
    evaluationId: result.evaluationId || null,
    evaluationRunId: result.evaluationRunId || null,
    finalScore: result.finalScore ?? null,
    questionScores: Array.isArray(result.questionScores) ? result.questionScores : [],
    criteria: Array.isArray(result.criteria) ? result.criteria : [],
    feedback: result.feedback ?? null,
    verification: result.verification || null,
    weighted: result.weighted || {},
  };
}

function evaluationHash(result) {
  return hashObject(evaluationSnapshot(result));
}

function verifyPersistedEvaluation({ submission, run }) {
  const issues = [];
  const integrity = submission?.integrity || {};

  if (!submission || !run) {
    issues.push({ type: "MISSING_INTEGRITY_SOURCE", message: "Submission atau evaluation run tidak tersedia." });
    return { valid: false, status: "FAIL", issues };
  }

  if (!integrity.attemptId || !run.attempt_id || integrity.attemptId !== run.attempt_id) {
    issues.push({ type: "ATTEMPT_MISMATCH", message: "Submission dan evaluation run tidak terikat pada attempt yang sama." });
  }
  if (!integrity.assessmentHash || integrity.assessmentHash !== run.assessment_hash) {
    issues.push({ type: "ASSESSMENT_HASH_MISMATCH", message: "Assessment hash submission berbeda dari evaluation run." });
  }
  if (!integrity.answerHash || integrity.answerHash !== run.answer_hash) {
    issues.push({ type: "ANSWER_HASH_MISMATCH", message: "Answer hash submission berbeda dari evaluation run." });
  }
  if (!integrity.rubricHash || integrity.rubricHash !== run.rubric_hash) {
    issues.push({ type: "RUBRIC_HASH_MISMATCH", message: "Rubric hash submission berbeda dari evaluation run." });
  }
  if (!integrity.evaluationHash || !run.evaluation_hash || integrity.evaluationHash !== run.evaluation_hash) {
    issues.push({ type: "EVALUATION_HASH_MISMATCH", message: "Evaluation hash tidak cocok dengan immutable evaluation trace." });
  }

  const criteria = Array.isArray(submission.criteria) ? submission.criteria : [];
  const criterionIds = new Set(criteria.map((c) => c?.criterionId).filter(Boolean));
  for (const criterion of criteria) {
    if (!criterion?.criterionId) {
      issues.push({ type: "INVALID_CRITERION", message: "Criterion tanpa criterionId." });
    }
    if (criterion && !Array.isArray(criterion.evidence)) {
      issues.push({ type: "INVALID_EVIDENCE", criterionId: criterion.criterionId || null, message: "Evidence harus berupa array." });
    }
  }

  return {
    valid: issues.length === 0,
    status: issues.length === 0 ? "PASS" : "FAIL",
    issues,
  };
}

module.exports = { evaluationSnapshot, evaluationHash, verifyPersistedEvaluation };
