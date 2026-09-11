const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildCompetencyTrajectory,
  level,
  trendForSnapshots,
} = require("../server/competency-trajectory");

test("builds longitudinal trajectory per learning outcome", () => {
  const result = buildCompetencyTrajectory([
    { learningOutcomeId: "LO1", learningOutcome: "Analisis", assessmentId: "a1", submittedAt: "2026-01-01", score: 62, evidenceCoverage: 0.5 },
    { learningOutcomeId: "LO1", learningOutcome: "Analisis", assessmentId: "a2", submittedAt: "2026-02-01", score: 74, evidenceCoverage: 0.75, evidenceGain: 1, probingCount: 1 },
    { learningOutcomeId: "LO1", learningOutcome: "Analisis", assessmentId: "a3", submittedAt: "2026-03-01", score: 86, evidenceCoverage: 1, evidenceCount: 3 },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].latest.score, 86);
  assert.equal(result[0].latest.level, "MASTERED");
  assert.equal(result[0].trend.direction, "IMPROVING");
  assert.equal(result[0].trend.delta, 24);
});

test("keeps learning outcomes separate", () => {
  const result = buildCompetencyTrajectory([
    { learningOutcomeId: "LO1", learningOutcome: "Konsep", score: 80 },
    { learningOutcomeId: "LO2", learningOutcome: "Penerapan", score: 60 },
  ]);
  assert.deepEqual(result.map((x) => x.learningOutcomeId), ["LO1", "LO2"]);
});

test("requires enough evidence for a confident competency state", () => {
  assert.equal(level(90, 0.25), "INSUFFICIENT_EVIDENCE");
  assert.equal(level(90, 0.5), "MASTERED");
});

test("detects stable and declining trajectories", () => {
  assert.equal(trendForSnapshots([{ score: 70 }, { score: 72 }]).direction, "STABLE");
  assert.equal(trendForSnapshots([{ score: 80 }, { score: 70 }]).direction, "DECLINING");
  assert.equal(trendForSnapshots([{ score: 80 }]).direction, "BASELINE");
});
