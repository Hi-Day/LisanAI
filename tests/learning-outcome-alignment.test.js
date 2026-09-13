const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseLearningOutcomes,
  coverageReport,
  validateLearningOutcomeCoverage,
  mapCriteriaToLearningOutcomes,
  ensureLearningOutcomeCoverage,
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

test("fills missing learning outcome mappings without changing question count or order", () => {
  const outcomes = parseLearningOutcomes("LO1 - Menjelaskan mekanisme pertukaran gas\nLO2 - Menganalisis hubungan struktur dan mekanisme\nLO3 - Menjelaskan mekanisme dengan penalaran logis");
  const questions = [
    { prompt: "Jelaskan mekanisme pertukaran gas di alveolus.", focus: "pertukaran gas" },
    { prompt: "Analisis hubungan struktur dengan mekanisme pertukaran gas.", focus: "struktur" },
    { prompt: "Jelaskan alasan mekanisme tersebut berlangsung secara logis.", focus: "penalaran" },
    { prompt: "Apa peran alveolus dalam pertukaran gas?", focus: "alveolus" },
    { prompt: "Mengapa struktur tertentu mendukung pertukaran gas?", focus: "struktur" },
  ];
  const mapped = ensureLearningOutcomeCoverage(questions, outcomes);
  assert.equal(mapped.length, 5);
  assert.deepEqual(mapped.map((q) => q.learningOutcomeId), ["LO1", "LO2", "LO3", "LO1", "LO2"]);
  assert.deepEqual(mapped.slice(0, 3).map((q) => q.outcome), outcomes.map((lo) => lo.text));
  assert.equal(coverageReport(mapped, outcomes).coveragePercent, 100);
});

test("uses explicit learning outcome IDs when the model provides them", () => {
  const outcomes = parseLearningOutcomes("LO1 - Menjelaskan konsep\nLO2 - Menganalisis hubungan");
  const questions = [
    { prompt: "Analisis hubungan konsep.", learningOutcomeId: "LO2" },
    { prompt: "Jelaskan konsep.", learningOutcomeId: "LO1" },
  ];
  const mapped = ensureLearningOutcomeCoverage(questions, outcomes);
  assert.deepEqual(mapped.map((q) => q.learningOutcomeId), ["LO2", "LO1"]);
});
