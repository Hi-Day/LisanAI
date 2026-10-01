const assert = require("node:assert/strict");
const test = require("node:test");
const { validateAssessmentIntegrity } = require("../server/assessment-integrity");

const base = {
  id: "assessment-1", classId: "class-1", topic: "Domain Adaptation",
  outcomes: "LO1: Explain domain shift\nLO2: Propose an adaptation strategy",
  questions: [
    { id: "q1", prompt: "Explain domain shift.", outcome: "Explain domain shift", learningOutcomeId: "LO1" },
    { id: "q2", prompt: "Propose an adaptation strategy.", outcome: "Propose an adaptation strategy", learningOutcomeId: "LO2" },
  ],
};

test("assessment integrity accepts fully mapped and covered outcomes", () => {
  const report = validateAssessmentIntegrity(base);
  assert.equal(report.valid, true); assert.equal(report.coveragePercent, 100);
  assert.deepEqual(report.coveredOutcomeIds, ["LO1", "LO2"]);
});
test("assessment integrity rejects an orphan question", () => {
  assert.throws(() => validateAssessmentIntegrity({ ...base, questions: [{ ...base.questions[0], learningOutcomeId: "", outcome: "Unknown outcome" }, base.questions[1]] }),
    (error) => error.code === "ASSESSMENT_QUESTION_LO_UNMAPPED");
});
test("assessment integrity rejects uncovered learning outcomes", () => {
  assert.throws(() => validateAssessmentIntegrity({ ...base, questions: [base.questions[0], { ...base.questions[0], id: "q2" }] }),
    (error) => error.code === "ASSESSMENT_LO_COVERAGE_INCOMPLETE");
});
test("assessment integrity keeps legacy assessments without explicit outcomes valid", () => {
  const report = validateAssessmentIntegrity({ ...base, outcomes: "", questions: [{ ...base.questions[0], learningOutcomeId: "", outcome: "" }] });
  assert.equal(report.valid, true); assert.equal(report.outcomeCount, 0);
});