const assert = require("node:assert/strict");
const test = require("node:test");

const {
  agreementMetrics,
  consistencyMetrics,
  groundingMetrics,
  complianceMetrics,
  summarizeExperimentMetrics,
} = require("../server/evaluation/benchmark/experiment-metrics");
const { runExperiment } = require("../server/evaluation/benchmark/benchmark");

// ---------------------------------------------------------------------------
// PR-10 / FR-14 — Experiment metrics
// ---------------------------------------------------------------------------

test("agreementMetrics computes Pearson/Spearman/MAE/RMSE/bands", () => {
  const ai = [80, 70, 90, 85, 75];
  const human = [78, 72, 88, 86, 74];
  const m = agreementMetrics(ai, human);
  assert.equal(m.n, 5);
  assert.ok(Number.isFinite(m.pearson));
  assert.ok(Number.isFinite(m.spearman));
  assert.ok(Number.isFinite(m.mae));
  assert.ok(Number.isFinite(m.rmse));
  assert.ok(m.exactAgreement >= 0 && m.exactAgreement <= 1);
  assert.ok(m.plus5 >= 0 && m.plus5 <= 1);
  assert.ok(m.plus10 >= 0 && m.plus10 <= 1);
});

test("agreementMetrics returns null on mismatched lengths", () => {
  assert.equal(agreementMetrics([1, 2], [1]), null);
  assert.equal(agreementMetrics([], []), null);
});

test("consistencyMetrics computes mean std/variance and range", () => {
  const runs = [
    [80, 70],
    [82, 72],
    [78, 69],
  ];
  const m = consistencyMetrics(runs);
  assert.equal(m.nRuns, 3);
  assert.ok(Number.isFinite(m.meanStd));
  assert.ok(Number.isFinite(m.meanVar));
  assert.ok(m.range.min === 69 && m.range.max === 82);
});

test("groundingMetrics aggregates harness reliability dimensions", () => {
  const results = [
    {
      evaluationMode: "harness",
      reliability: { dimensions: { evidenceGrounding: 1, criterionCoverage: 1 } },
    },
    {
      evaluationMode: "harness",
      reliability: { dimensions: { evidenceGrounding: 0.5, criterionCoverage: 0.75 } },
    },
    { evaluationMode: "baseline", score: 80 }, // excluded
  ];
  const m = groundingMetrics(results);
  assert.equal(m.n, 2);
  assert.equal(m.evidenceGrounding, 0.75);
  assert.equal(m.criterionCoverage, 0.875);
});

test("complianceMetrics computes pass/review/fail rates", () => {
  const results = [
    { evaluationMode: "harness", verification: { status: "PASS" } },
    { evaluationMode: "harness", verification: { status: "REVIEW" } },
    { evaluationMode: "harness", verification: { status: "FAIL" } },
    { evaluationMode: "baseline" },
  ];
  const m = complianceMetrics(results);
  assert.equal(m.n, 3);
  assert.equal(m.passRate, 1 / 3);
  assert.equal(m.reviewRate, 1 / 3);
  assert.equal(m.failRate, 1 / 3);
});

test("summarizeExperimentMetrics produces agreement/means/grounding/compliance", async () => {
  const exp = await runExperiment({ dataset: "sample-bench-smoke", mode: ["baseline", "harness"] });
  const s = summarizeExperimentMetrics(exp);
  assert.ok(s.agreement.baseline, "baseline agreement present");
  assert.ok(s.agreement.harness, "harness agreement present");
  assert.ok(s.means.baseline != null);
  assert.ok(s.means.harness != null);
  assert.ok(s.grounding, "grounding present (harness-only)");
  assert.ok(s.compliance, "compliance present (harness-only)");
  assert.ok(exp.metrics, "runExperiment should embed metrics");
});

test("full experiment exposes metrics alongside results", async () => {
  const exp = await runExperiment({ dataset: "sample-bench-smoke", mode: "harness" });
  assert.ok(exp.metrics.agreement.harness);
  assert.ok(exp.metrics.grounding);
  assert.ok(exp.metrics.compliance);
});