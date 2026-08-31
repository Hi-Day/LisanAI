const assert = require("node:assert/strict");
const test = require("node:test");
const { DEFAULT_CONDITIONS, summarizeResult } = require("../server/research/experiment-runner");
const { computeExperimentMetrics } = require("../server/research/metrics");

test("default experiment conditions form a progressive harness ablation", () => {
  assert.equal(DEFAULT_CONDITIONS.length, 5);
  assert.deepEqual(DEFAULT_CONDITIONS.map((x) => x.id), [
    "baseline",
    "rubric",
    "rubric-evidence",
    "rubric-evidence-verification",
    "full-harness",
  ]);
  assert.equal(DEFAULT_CONDITIONS[0].harness.rubric, false);
  assert.equal(DEFAULT_CONDITIONS[4].harness.reliability, true);
});

test("experiment metrics compute human agreement and verification rate", () => {
  const metrics = computeExperimentMetrics([
    { condition: { id: "a", label: "A" }, result: { finalScore: 80, verificationStatus: "PASS", verificationValid: true, reliability: 0.9, riskScore: 0.1, riskLevel: "low" } },
    { condition: { id: "b", label: "B" }, result: { finalScore: 60, verificationStatus: "FAIL", verificationValid: false, reliability: 0.4, riskScore: 0.8, riskLevel: "high" } },
  ], { a: 75, b: 50 });

  assert.equal(metrics.summary.meanAbsoluteError, 7.5);
  assert.equal(metrics.summary.verificationPassRate, 0.5);
  assert.equal(metrics.conditions[0].agreement, 0.95);
});

test("result summary preserves run and provenance identifiers", () => {
  const summary = summarizeResult({
    evaluationRunId: "run_1",
    finalScore: 90,
    published: true,
    requiresHumanReview: false,
    verification: { status: "PASS", valid: true },
    reliability: { overallReliability: 0.92 },
    risk: { score: 0.1, level: "low" },
    versioning: { rubricVersion: "r1", harnessVersion: "h1" },
    harnessManifest: { manifestVersion: "1.0.0" },
  });
  assert.equal(summary.evaluationRunId, "run_1");
  assert.equal(summary.harnessVersion, "h1");
  assert.equal(summary.riskLevel, "low");
});
