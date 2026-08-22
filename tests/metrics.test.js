const test = require("node:test");
const assert = require("node:assert/strict");

const {
  pearson,
  spearman,
  rank,
  mae,
  rmse,
  exactAgreement,
  adjacentAgreement,
  interRunVariance,
  computeMetrics,
} = require("../server/evaluation/metrics");

const { compareBaselineVsHarness } = require("../server/evaluation/research");

test("pearson perfect positive correlation = 1", () => {
  assert.equal(pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1);
});

test("pearson perfect negative correlation = -1", () => {
  assert.equal(pearson([1, 2, 3, 4], [4, 3, 2, 1]), -1);
});

test("pearson uncorrelated ~ 0", () => {
  const r = pearson([1, 2, 3, 4], [1, 1, 1, 1]);
  assert.ok(Number.isNaN(r)); // zero variance denominator
});

test("spearman equals pearson on ranks for monotonic data", () => {
  const a = [10, 20, 30, 40];
  const b = [1, 2, 3, 4];
  assert.equal(spearman(a, b), 1);
});

test("rank handles ties with average rank", () => {
  // [10,20,20,30] ranks: 1, 2.5, 2.5, 4
  assert.deepEqual(rank([10, 20, 20, 30]), [1, 2.5, 2.5, 4]);
});

test("mae and rmse computed correctly", () => {
  const a = [1, 2, 3];
  const b = [2, 3, 4];
  assert.equal(mae(a, b), 1);
  assert.equal(rmse(a, b), 1);
});

test("exact and adjacent agreement", () => {
  assert.equal(exactAgreement([1, 2, 3], [1, 2, 3]), 1);
  assert.equal(exactAgreement([1, 2, 3], [1, 2, 9]), 2 / 3);
  assert.equal(adjacentAgreement([80, 70], [82, 72], 5), 1);
  assert.equal(adjacentAgreement([80, 70], [90, 79], 5), 0);
});

test("interRunVariance penalizes inconsistent runs", () => {
  const stable = [[80, 80, 80]];
  const unstable = [[50, 50, 50], [90, 90, 90]];
  const vStable = interRunVariance(stable);
  const vUnstable = interRunVariance(unstable);
  assert.equal(vStable, 0);
  assert.ok(vUnstable > vStable);
});

test("computeMetrics returns full validity + reliability report", () => {
  const ai = [10, 20, 30, 40];
  const human = [10, 20, 30, 40];
  const res = computeMetrics(ai, human);
  assert.equal(res.n, 4);
  assert.equal(res.validity.pearson, 1);
  assert.equal(res.validity.spearman, 1);
  assert.equal(res.validity.mae, 0);
  assert.equal(res.validity.rmse, 0);
  assert.equal(res.reliability.exactAgreement, 1);
});

test("compareBaselineVsHarness produces summary", () => {
  const pairs = [
    { baselineScore: 80, harness: 82 },
    { baselineScore: 70, harness: 74 },
  ];
  const res = compareBaselineVsHarness(pairs);
  assert.equal(res.n, 2);
  assert.equal(res.meanBaseline, 75);
  assert.equal(res.meanHarness, 78);
  assert.equal(res.metrics.validity.mae, 3);
});