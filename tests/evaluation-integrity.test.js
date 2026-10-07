const test = require("node:test");
const assert = require("node:assert/strict");

const { evaluationHash, evaluationSnapshot, verifyPersistedEvaluation } = require("../server/security/evaluation-integrity");

function sampleResult() {
  return {
    evaluationId: "eval_1",
    evaluationRunId: "run_1",
    finalScore: 82,
    questionScores: [{ question: "Q1", answer: "jawaban", score: 82 }],
    criteria: [{
      criterionId: "C1",
      score: 82,
      evidence: [{ text: "jawaban", grounded: true }],
      rationale: "Evidence mendukung skor.",
    }],
    feedback: "Baik.",
    verification: { valid: true, status: "PASS", issues: [] },
    weighted: { detail: [{ criterionId: "C1", weight: 1 }] },
  };
}

test("evaluation hash is deterministic for the immutable evaluation payload", () => {
  const result = sampleResult();
  assert.equal(evaluationHash(result), evaluationHash(JSON.parse(JSON.stringify(result))));
  assert.notEqual(evaluationHash(result), evaluationHash({ ...result, finalScore: 40 }));
});

test("teacher-review metadata is outside the immutable evaluation snapshot", () => {
  const snapshot = evaluationSnapshot(sampleResult());
  assert.equal(snapshot.teacherCorrection, undefined);
  assert.equal(snapshot.complaint, undefined);
});

test("persisted evaluation passes when all integrity bindings match", () => {
  const result = sampleResult();
  const hash = evaluationHash(result);
  const submission = {
    integrity: {
      attemptId: "attempt_1",
      assessmentHash: "assessment_hash",
      answerHash: "answer_hash",
      rubricHash: "rubric_hash",
      evaluationHash: hash,
    },
    criteria: result.criteria,
  };
  const run = {
    attempt_id: "attempt_1",
    assessment_hash: "assessment_hash",
    answer_hash: "answer_hash",
    rubric_hash: "rubric_hash",
    evaluation_hash: hash,
  };
  assert.deepEqual(verifyPersistedEvaluation({ submission, run }).status, "PASS");
});

test("tampered evaluation hash fails integrity verification", () => {
  const result = sampleResult();
  const submission = {
    integrity: {
      attemptId: "attempt_1",
      assessmentHash: "assessment_hash",
      answerHash: "answer_hash",
      rubricHash: "rubric_hash",
      evaluationHash: "tampered",
    },
    criteria: result.criteria,
  };
  const run = {
    attempt_id: "attempt_1",
    assessment_hash: "assessment_hash",
    answer_hash: "answer_hash",
    rubric_hash: "rubric_hash",
    evaluation_hash: evaluationHash(result),
  };
  const out = verifyPersistedEvaluation({ submission, run });
  assert.equal(out.status, "FAIL");
  assert.ok(out.issues.some((issue) => issue.type === "EVALUATION_HASH_MISMATCH"));
});

test("tampered attempt binding fails integrity verification", () => {
  const result = sampleResult();
  const hash = evaluationHash(result);
  const out = verifyPersistedEvaluation({
    submission: {
      integrity: { attemptId: "attempt_attacker", assessmentHash: "assessment_hash", answerHash: "answer_hash", rubricHash: "rubric_hash", evaluationHash: hash },
      criteria: result.criteria,
    },
    run: {
      attempt_id: "attempt_owner",
      assessment_hash: "assessment_hash",
      answer_hash: "answer_hash",
      rubric_hash: "rubric_hash",
      evaluation_hash: hash,
    },
  });
  assert.equal(out.status, "FAIL");
  assert.ok(out.issues.some((issue) => issue.type === "ATTEMPT_MISMATCH"));
});
