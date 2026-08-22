/**
 * Evaluation metrics for research (PRD §21).
 * Validity: Pearson, Spearman, MAE, RMSE
 * Reliability: inter-run variance, score stddev, exact/adjacent agreement
 * All functions are deterministic and dependency-free.
 */

function mean(xs) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function std(xs) {
  const n = xs.length;
  if (n === 0) return 0;
  const m = mean(xs);
  const variance = xs.reduce((a, b) => a + (b - m) ** 2, 0) / n;
  return Math.sqrt(variance);
}

/**
 * Pearson correlation coefficient between two arrays (both same length).
 */
function pearson(a, b) {
  if (a.length !== b.length || a.length === 0) return NaN;
  const n = a.length;
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i += 1) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y;
    da += x ** 2;
    db += y ** 2;
  }
  const denom = Math.sqrt(da * db);
  return denom === 0 ? NaN : num / denom;
}

/**
 * Spearman rank correlation coefficient.
 */
function spearman(a, b) {
  if (a.length !== b.length || a.length === 0) return NaN;
  const rankA = rank(a);
  const rankB = rank(b);
  return pearson(rankA, rankB);
}

function rank(xs) {
  const indexed = xs.map((v, i) => ({ v, i }));
  indexed.sort((x, y) => x.v - y.v);
  const ranks = new Array(xs.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) j += 1;
    const avg = (i + j) / 2 + 1; // 1-based avg rank for ties
    for (let k = i; k <= j; k += 1) ranks[indexed[k].i] = avg;
    i = j + 1;
  }
  return ranks;
}

function mae(a, b) {
  if (a.length === 0) return NaN;
  return a.reduce((acc, v, i) => acc + Math.abs(v - b[i]), 0) / a.length;
}

function rmse(a, b) {
  if (a.length === 0) return NaN;
  return Math.sqrt(a.reduce((acc, v, i) => acc + (v - b[i]) ** 2, 0) / a.length);
}

/**
 * Exact agreement: proportion of identical scores.
 */
function exactAgreement(a, b) {
  if (a.length === 0) return NaN;
  let same = 0;
  for (let i = 0; i < a.length; i += 1) if (a[i] === b[i]) same += 1;
  return same / a.length;
}

/**
 * Adjacent agreement: proportion where |a-b| <= tolerance (default 5 pts).
 */
function adjacentAgreement(a, b, tolerance = 5) {
  if (a.length === 0) return NaN;
  let ok = 0;
  for (let i = 0; i < a.length; i += 1) if (Math.abs(a[i] - b[i]) <= tolerance) ok += 1;
  return ok / a.length;
}

/**
 * Inter-run variance across repeated AI scores for the same submissions.
 * @param runs array of arrays (each run = array of scores for each submission)
 */
function interRunVariance(runs) {
  const nSub = runs[0] ? runs[0].length : 0;
  const variances = [];
  for (let s = 0; s < nSub; s += 1) {
    const scores = runs.map((r) => r[s]);
    variances.push(std(scores) ** 2);
  }
  return mean(variances);
}

/**
 * Full research metrics between AI and human score vectors.
 */
function evaluateMetrics(ai, human) {
  return {
    n: ai.length,
    validity: {
      pearson: pearson(ai, human),
      spearman: spearman(ai, human),
      mae: mae(ai, human),
      rmse: rmse(ai, human),
    },
    reliability: {
      aiStd: std(ai),
      exactAgreement: exactAgreement(ai, human),
      adjacentAgreement: adjacentAgreement(ai, human),
    },
  };
}

module.exports = {
  mean,
  std,
  pearson,
  spearman,
  rank,
  mae,
  rmse,
  exactAgreement,
  adjacentAgreement,
  interRunVariance,
  computeMetrics: evaluateMetrics,
};