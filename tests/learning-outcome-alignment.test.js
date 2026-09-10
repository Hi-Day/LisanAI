const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseLearningOutcomes,
  coverageReport,
  validateLearningOutcomeCoverage,
  mapCriteriaToLearningOutcomes,
} = require("../server/harness/learning-outcome-alignment");

test("parses numbered learning outcomes into stable IDs", () => {
  const outcomes = parseLearningOutcomes("1. Menganalisis masalah\n2. Mengevaluasi alternatif\n3. Menjustifikasi keputusan");
  assert.deepEqual(outcomes.map((x) => x.id), ["LO1", "LO2", "LO3"]);
  assert.equal(outcomes[1].text, "Mengevaluasi alternatif");
});

test("reports incomplete learning outcome coverage", () => {
  const outcomes = parseLearningOutcomes("LO1 - Menganalisis masalah\nLO2 - Mengevaluasi alternatif");
  const questions = [
    { prompt: "Mengapa masalah terjadi?", learningOutcomeId: "LO1" },
  ];
  const report = coverageReport(questions, outcomes);
  assert.equal(report.coveragePercent, 50);
  assert.deepEqual(report.missing.map((x) => x.id), ["LO2"]);
  assert.throws(() => validateLearningOutcomeCoverage(questions, outcomes), {
    code: "LEARNING_OUTCOME_COVERAGE_INCOMPLETE",
  });
});

test("maps criteria to the learning outcome of their question", () => {
  const outcomes = parseLearningOutcomes("LO1 - Analyze\nLO2 - Evaluate");
  const questions = [
    { learningOutcomeId: "LO1", criteria: [{ id: "C1", name: "Reasoning" }] },
    { learningOutcomeId: "LO2", criteria: [{ id: "C2", name: "Judgment" }] },
  ];
  const map = mapCriteriaToLearningOutcomes(questions, outcomes);
  assert.deepEqual(map.byCriterion.get("C1").map((x) => x.id), ["LO1"]);
  assert.deepEqual(map.byCriterion.get("C2").map((x) => x.id), ["LO2"]);
});
