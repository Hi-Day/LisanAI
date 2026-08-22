const test = require("node:test");
const assert = require("node:assert/strict");

const {
  cohensKappa,
  weightedKappa,
  iccTwoWay,
  interRaterMetrics,
  pearson,
  spearman,
  exactAgreement,
} = require("../server/evaluation/metrics");

const {
  interRaterAggregation,
  complianceMetrics,
} = require("../server/evaluation/benchmark/experiment-metrics");

const { buildRaterMap } = require("../server/evaluation/benchmark/benchmark");
const { summarizeExperimentMetrics } = require("../server/evaluation/benchmark/experiment-metrics");

// ---- Cohen's Kappa ----
test("cohensKappa perfect agreement = 1", () => {
  assert.equal(cohensKappa(["a", "b", "a", "b"], ["a", "b", "a", "b"]), 1);
});

test("cohensKappa random-ish agreement is low", () => {
  const k = cohensKappa(["a", "a", "b", "b"], ["a", "b", "a", "b"]);
  // 2/4 observed; expected = (2*2+2*2)/16 = 0.5 → kappa = (0.5-0.5)/(1-0.5)=0
  assert.ok(Math.abs(k) < 1e-9);
});

// ---- Weighted (quadratic) Kappa ----
test("weightedKappa equals 1 on perfect agreement", () => {
  assert.equal(weightedKappa([1, 2, 3, 4], [1, 2, 3, 4]), 1);
});

test("weightedKappa gives higher value for near-miss than far-miss", () => {
  const near = weightedKappa([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]);
  assert.equal(near, 1);
  // Near-miss (all +1) should beat far-miss (one large jump).
  const close = weightedKappa([1, 2, 3, 4], [2, 3, 4, 5]);
  const far = weightedKappa([1, 2, 3, 4], [4, 4, 1, 5]);
  assert.ok(close > far, "near-miss should agree more than far-miss");
});

// ---- ICC (two-way, absolute) ----
test("iccTwoWay perfect agreement = 1", () => {
  const matrix = [
    [70, 70],
    [80, 80],
    [90, 90],
  ];
  const { icc } = iccTwoWay(matrix);
  assert.ok(Math.abs(icc - 1) < 1e-9, `icc=${icc}`);
});

test("iccTwoWay returns metrics object", () => {
  const res = iccTwoWay([
    [70, 72, 71],
    [85, 84, 85],
    [60, 61, 59],
  ]);
  assert.ok(typeof res.icc === "number");
  assert.equal(res.nSubjects, 3);
  assert.equal(res.nRaters, 3);
});

// ---- interRaterMetrics convenience ----
test("interRaterMetrics aggregates all agreement stats", () => {
  const a = [80, 85, 90, 75, 60];
  const b = [80, 80, 92, 78, 65];
  const m = interRaterMetrics(a, b);
  assert.equal(m.n, 5);
  assert.equal(m.exactAgreement, exactAgreement(a, b));
  assert.equal(m.pearson, pearson(a, b));
  assert.equal(m.spearman, spearman(a, b));
  assert.ok(typeof m.cohensKappa === "number");
  assert.ok(typeof m.weightedKappa === "number");
});

// ---- Aggregation + compliance ----
test("interRaterAggregation returns pairs + icc for 2 raters", () => {
  const agg = interRaterAggregation({
    "rater-1": [80, 85, 90],
    "rater-2": [78, 86, 91],
  });
  assert.equal(agg.nRaters, 2);
  assert.equal(agg.pairs.length, 1);
  assert.ok(agg.icc && typeof agg.icc.icc === "number");
});

test("interRaterAggregation returns null for <2 raters", () => {
  assert.equal(interRaterAggregation({ "rater-1": [80, 85] }), null);
});

test("complianceMetrics reports evidence status rates", () => {
  const results = [
    {
      evaluationMode: "harness",
      verification: { status: "PASS" },
      criteria: [
        { criterionId: "C1", evidenceStatus: "GROUNDED" },
        { criterionId: "C2", evidenceStatus: "MISSING", noEvidence: true },
      ],
    },
    {
      evaluationMode: "harness",
      verification: { status: "REVIEW" },
      criteria: [{ criterionId: "C1", evidenceStatus: "UNSUPPORTED" }],
    },
  ];
  const c = complianceMetrics(results);
  assert.equal(c.passRate, 0.5);
  assert.equal(c.reviewRate, 0.5);
  assert.equal(c.evidence.groundedRate, 1 / 3);
  assert.equal(c.evidence.unsupportedRate, 1 / 3);
  assert.equal(c.evidence.missingRate, 1 / 3);
});

// ---- buildRaterMap from dataset ----
test("buildRaterMap collects per-rater scores from raterScores", () => {
  const samples = [
    {
      sampleId: "A",
      humanCriterionScores: { raterScores: { "rater-1": 85, "rater-2": 80 } },
    },
    {
      sampleId: "B",
      humanCriterionScores: { raterScores: { "rater-1": 78, "rater-2": 82 } },
    },
  ];
  const map = buildRaterMap(samples);
  assert.deepEqual(map["rater-1"], [85, 78]);
  assert.deepEqual(map["rater-2"], [80, 82]);
});

test("buildRaterMap ignores flat criterion map (not per-rater)", () => {
  const samples = [
    {
      sampleId: "A",
      humanCriterionScores: { concept: 85, application: 78 },
      annotatorId: "rater-1",
    },
  ];
  assert.equal(buildRaterMap(samples), null);
});

test("summarizeExperimentMetrics includes interRater when raterMap present", () => {
  const exp = {
    results: [
      {
        evaluationMode: "harness",
        score: 85,
        humanScore: 85,
        verification: { status: "PASS" },
        criteria: [{ criterionId: "C1", evidenceStatus: "GROUNDED" }],
      },
    ],
    raterMap: {
      "rater-1": [85, 78],
      "rater-2": [80, 82],
    },
  };
  const m = summarizeExperimentMetrics(exp);
  assert.ok(m.interRater, "interRater should be present");
  assert.equal(m.interRater.nRaters, 2);
  assert.equal(m.interRater.pairs.length, 1);
});