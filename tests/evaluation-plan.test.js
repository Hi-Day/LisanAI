const test = require("node:test");
const assert = require("node:assert/strict");

const { buildEvaluationPlan } = require("../server/harness/evaluation-plan");

const RUBRIC = {
  criteria: [
    { id: "accuracy", name: "Akurasi Konsep", weight: 0.4 },
    { id: "completeness", name: "Kelengkapan", weight: 0.3 },
    { id: "reasoning", name: "Penalaran Sebab Akibat", weight: 0.3 },
  ],
};

const QUESTIONS = [
  { index: 0, questionId: "q1", prompt: "Jelaskan fotosintesis.", focus: "fotosintesis", criteria: ["accuracy"] },
  { index: 1, questionId: "q2", prompt: "Mengapa cahaya penting?", focus: "cahaya", criteria: ["reasoning"] },
  { index: 2, questionId: "q3", prompt: "Sebutkan hasil fotosintesis.", focus: "hasil", criteria: ["completeness"] },
];

// ---------------------------------------------------------------------------
// Valid mapping
// ---------------------------------------------------------------------------

test("plan: valid explicit mapping", () => {
  const plan = buildEvaluationPlan({ questions: QUESTIONS, rubric: RUBRIC, assessmentId: "a1" });
  assert.equal(plan.questions.length, 3);
  assert.equal(plan.questions[0].criterionIds[0], "accuracy");
  assert.equal(plan.rubricVersion, "v1");
  assert.equal(plan.assessmentId, "a1");
  assert.ok(plan.evaluationPlanId.startsWith("plan_"));
  assert.deepEqual(plan.uncoveredCriterionIds, []);
});

test("plan: deterministic plan id for identical input", () => {
  const a = buildEvaluationPlan({ questions: QUESTIONS, rubric: RUBRIC });
  const b = buildEvaluationPlan({ questions: QUESTIONS, rubric: RUBRIC });
  assert.equal(a.evaluationPlanId, b.evaluationPlanId);
});

test("plan: question criterionIds normalized to {index, questionId, prompt}", () => {
  const plan = buildEvaluationPlan({ questions: QUESTIONS, rubric: RUBRIC });
  for (const q of plan.questions) {
    assert.equal(typeof q.index, "number");
    assert.equal(typeof q.questionId, "string");
    assert.equal(typeof q.prompt, "string");
    assert.ok(Array.isArray(q.criterionIds));
  }
});

// ---------------------------------------------------------------------------
// Deterministic fallback mapping
// ---------------------------------------------------------------------------

test("plan: best-fit mapping when question has no criteria", () => {
  const questions = [{ index: 0, questionId: "q1", prompt: "Jelaskan akurasi konsep fotosintesis." }];
  const plan = buildEvaluationPlan({ questions, rubric: RUBRIC });
  assert.equal(plan.questions[0].criterionIds.length, 1);
  assert.equal(plan.questions[0].criterionIds[0], "accuracy");
});

test("plan: best-fit is deterministic across repeated calls", () => {
  const questions = [{ index: 0, questionId: "q1", prompt: "Jelaskan akurasi konsep fotosintesis." }];
  const a = buildEvaluationPlan({ questions, rubric: RUBRIC });
  const b = buildEvaluationPlan({ questions, rubric: RUBRIC });
  assert.deepEqual(a.questions[0].criterionIds, b.questions[0].criterionIds);
});

// ---------------------------------------------------------------------------
// Invalid mapping
// ---------------------------------------------------------------------------

test("plan: unknown criterion id in question mapping rejected", () => {
  assert.throws(
    () =>
      buildEvaluationPlan({
        questions: [{ index: 0, questionId: "q1", prompt: "x", criteria: ["nonexistent"] }],
        rubric: RUBRIC,
      }),
    /criterion.*tidak ada di rubric/
  );
});

test("plan: question with no mappable criteria rejected", () => {
  assert.throws(
    () =>
      buildEvaluationPlan({
        questions: [{ index: 0, questionId: "q1", prompt: "zzz qqq" }],
        rubric: { criteria: [{ id: "accuracy", name: "Akurasi Konsep Arsitektur Laut", weight: 1 }] },
      }),
    /criterion mapping valid/
  );
});

test("plan: duplicate questionId rejected", () => {
  assert.throws(
    () =>
      buildEvaluationPlan({
        questions: [
          { index: 0, questionId: "q1", prompt: "x", criteria: ["accuracy"] },
          { index: 1, questionId: "q1", prompt: "y", criteria: ["accuracy"] },
        ],
        rubric: RUBRIC,
      }),
    /duplikat dalam plan/
  );
});

test("plan: empty questions rejected", () => {
  assert.throws(() => buildEvaluationPlan({ questions: [], rubric: RUBRIC }), /questions array non-empty/);
});

// ---------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------

test("plan: reports uncovered criteria without failing", () => {
  const questions = [{ index: 0, questionId: "q1", prompt: "x", criteria: ["accuracy"] }];
  const plan = buildEvaluationPlan({ questions, rubric: RUBRIC });
  assert.deepEqual(plan.uncoveredCriterionIds.sort(), ["completeness", "reasoning"].sort());
});

test("plan: multiple criteria mapped to one question", () => {
  const questions = [{ index: 0, questionId: "q1", prompt: "x", criteria: ["accuracy", "completeness"] }];
  const plan = buildEvaluationPlan({ questions, rubric: RUBRIC });
  assert.deepEqual(plan.questions[0].criterionIds.sort(), ["accuracy", "completeness"].sort());
});