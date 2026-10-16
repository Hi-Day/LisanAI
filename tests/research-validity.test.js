const test = require("node:test");
const assert = require("node:assert/strict");
const { assessResearchValidity } = require("../server/evaluation/research-validity");

test("research validity is INSUFFICIENT below minimum paired observations", () => {
  const out = assessResearchValidity({
    aiScores: [80, 82],
    humanScores: [81, 80],
    confidence: [0.8, 0.9],
    correctness: [1, 1],
    minSamples: 30,
  });
  assert.equal(out.status, "INSUFFICIENT");
  assert.equal(out.dataSufficient, false);
  assert.ok(out.issues.some((x) => x.code === "INSUFFICIENT_HUMAN_REVIEW"));
});

test("research validity passes when configured evidence is sufficient and thresholds are met", () => {
  const n = 30;
  const out = assessResearchValidity({
    aiScores: Array(n).fill(80),
    humanScores: Array(n).fill(80),
    confidence: Array(n).fill(0.95),
    correctness: Array(n).fill(1),
    evidenceValidity: 1,
    repeatability: { stableRatio: 1 },
    minSamples: 30,
  });
  assert.equal(out.status, "PASS");
  assert.equal(out.dataSufficient, true);
  assert.equal(out.metrics.mae, 0);
  assert.equal(out.metrics.ece, 0);
});

test("research validity flags high error and poor calibration", () => {
  const n = 30;
  const out = assessResearchValidity({
    aiScores: Array(n).fill(95),
    humanScores: Array(n).fill(60),
    confidence: Array(n).fill(0.95),
    correctness: Array(n).fill(0),
    evidenceValidity: 0.7,
    repeatability: { stableRatio: 0.5 },
    minSamples: 30,
  });
  assert.equal(out.status, "REVIEW");
  assert.ok(out.issues.some((x) => x.code === "HIGH_MAE"));
  assert.ok(out.issues.some((x) => x.code === "HIGH_ECE"));
  assert.ok(out.issues.some((x) => x.code === "LOW_EVIDENCE_VALIDITY"));
  assert.ok(out.issues.some((x) => x.code === "LOW_REPEATABILITY"));
});
