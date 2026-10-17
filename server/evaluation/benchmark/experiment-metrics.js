const {
  computeMetrics: baseMetrics,
  mean,
  std,
  pearson,
  spearman,
  mae,
  rmse,
  exactAgreement,
  adjacentAgreement,
  cohensKappa,
  weightedKappa,
  iccTwoWay,
  interRaterMetrics,
} = require("../metrics");

/**
 * PRD FR-14 §22 — Experiment metrics aggregation (PR-10).
 *
 * Given a runExperiment() result, produce compact research metrics:
 *   agreement      — Pearson, Spearman, MAE, RMSE, exact/±5/±10 bands
 *   consistency    — repeated-run variance (when runs param supplied)
 *   grounding      — evidence grounding rate + criterion coverage
 *   compliance     — verification pass/review/fail rates
 */

/**
 * Agreement metrics between AI scores and human ground truth.
 */
function agreementMetrics(aiScores, humanScores) {
  if (!aiScores || !humanScores || aiScores.length === 0 || aiScores.length !== humanScores.length) {
    return null;
  }
  return {
    n: aiScores.length,
    pearson: pearson(aiScores, humanScores),
    spearman: spearman(aiScores, humanScores),
    mae: mae(aiScores, humanScores),
    rmse: rmse(aiScores, humanScores),
    exactAgreement: exactAgreement(aiScores, humanScores),
    plus5: adjacentAgreement(aiScores, humanScores, 5),
    plus10: adjacentAgreement(aiScores, humanScores, 10),
    calibration: calibrationMetrics(aiScores, humanScores),
  };
}

/**
 * Calibration metrics for continuous 0–100 scores.
 *
 * Scores are grouped into equal-width bins by predicted score. The reported
 * calibration error is the weighted mean absolute gap between the mean
 * predicted and mean human score in each non-empty bin. Bias is signed
 * (prediction - human), so positive values indicate systematic over-scoring.
 */
function calibrationMetrics(aiScores, humanScores, binCount = 10) {
  if (!Array.isArray(aiScores) || !Array.isArray(humanScores) ||
      aiScores.length === 0 || aiScores.length !== humanScores.length) return null;
  const bins = Math.max(2, Math.min(20, Number(binCount) || 10));
  const groups = Array.from({ length: bins }, () => ({ predicted: [], human: [] }));
  aiScores.forEach((score, i) => {
    const predicted = Number(score);
    const human = Number(humanScores[i]);
    if (!Number.isFinite(predicted) || !Number.isFinite(human)) return;
    const index = Math.min(bins - 1, Math.max(0, Math.floor((predicted / 100) * bins)));
    groups[index].predicted.push(predicted);
    groups[index].human.push(human);
  });
  const populated = groups.map((g, index) => {
    if (!g.predicted.length) return null;
    const predictedMean = mean(g.predicted);
    const humanMean = mean(g.human);
    return {
      bin: index,
      count: g.predicted.length,
      predictedMean,
      humanMean,
      gap: predictedMean - humanMean,
      absoluteGap: Math.abs(predictedMean - humanMean),
    };
  }).filter(Boolean);
  const total = populated.reduce((sum, b) => sum + b.count, 0);
  if (!total) return null;
  return {
    n: total,
    bins: populated,
    expectedCalibrationError: populated.reduce((sum, b) => sum + (b.count / total) * b.absoluteGap, 0),
    meanBias: populated.reduce((sum, b) => sum + b.count * b.gap, 0) / total,
  };
}

/**
 * Consistency metrics from repeated evaluations of the same inputs.
 * @param runs array of arrays (each = scores for the same submission list)
 */
function consistencyMetrics(runs) {
  if (!Array.isArray(runs) || runs.length === 0) return null;
  const nSub = runs[0].length;
  const perSub = [];
  for (let s = 0; s < nSub; s += 1) {
    perSub.push(runs.map((r) => r[s]));
  }
  return {
    nRuns: runs.length,
    meanStd: mean(perSub.map((s) => std(s))),
    meanVar: mean(perSub.map((s) => std(s) ** 2)),
    range: {
      min: Math.min(...perSub.map((s) => Math.min(...s))),
      max: Math.max(...perSub.map((s) => Math.max(...s))),
    },
  };
}

/**
 * Reliability/grounding metrics aggregated across harness results.
 */
function groundingMetrics(results) {
  const harness = (results || []).filter((r) => r.evaluationMode === "harness");
  if (harness.length === 0) return null;
  const grounding = harness.map((r) =>
    r.reliability ? r.reliability.dimensions.evidenceGrounding : null
  );
  const coverage = harness.map((r) =>
    r.reliability ? r.reliability.dimensions.criterionCoverage : null
  );
  const avg = (xs) => {
    const present = xs.filter((v) => v !== null);
    return present.length ? mean(present) : null;
  };
  return {
    n: harness.length,
    evidenceGrounding: avg(grounding),
    criterionCoverage: avg(coverage),
  };
}

/**
 * Output compliance — verification status rates across harness results.
 */
function complianceMetrics(results) {
  const harness = (results || []).filter((r) => r.evaluationMode === "harness");
  if (harness.length === 0) return null;
  const n = harness.length;
  const count = (s) => harness.filter((r) => r.verification && r.verification.status === s).length;

  // FR-06 evidence status rates across harness criteria.
  const evidenceStatusCounts = { GROUNDED: 0, UNSUPPORTED: 0, MISSING: 0 };
  let criteriaCount = 0;
  for (const r of harness) {
    for (const c of (r.criteria || [])) {
      criteriaCount += 1;
      if (c.evidenceStatus === "UNSUPPORTED") evidenceStatusCounts.UNSUPPORTED += 1;
      else if (c.noEvidence === true || c.evidenceStatus === "MISSING") evidenceStatusCounts.MISSING += 1;
      else evidenceStatusCounts.GROUNDED += 1;
    }
  }

  return {
    n,
    passRate: count("PASS") / n,
    reviewRate: count("REVIEW") / n,
    failRate: count("FAIL") / n,
    evidence: criteriaCount
      ? {
          groundedRate: evidenceStatusCounts.GROUNDED / criteriaCount,
          unsupportedRate: evidenceStatusCounts.UNSUPPORTED / criteriaCount,
          missingRate: evidenceStatusCounts.MISSING / criteriaCount,
        }
      : null,
  };
}

/**
 * Inter-rater reliability across human raters (PRD FR-20).
 * Accepts an object keyed by raterId → array of scores (same length, one per
 * sample). Returns agreement metrics for each rater pair, plus the mean.
 */
function interRaterAggregation(raterMap) {
  const ids = Object.keys(raterMap || {});
  if (ids.length < 2) return null;
  const pairs = [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      pairs.push({
        raterA: ids[i],
        raterB: ids[j],
        metrics: interRaterMetrics(raterMap[ids[i]], raterMap[ids[j]]),
      });
    }
  }
  // Build subject×rater matrix for ICC (requires equal rater sets).
  const lens = new Set(ids.map((id) => (raterMap[id] || []).length));
  let icc = null;
  if (lens.size === 1) {
    const nSub = [...lens][0];
    const matrix = [];
    for (let s = 0; s < nSub; s += 1) {
      matrix.push(ids.map((id) => raterMap[id][s]));
    }
    icc = iccTwoWay(matrix);
  }
  return { pairs, icc, nRaters: ids.length };
}

/**
 * Compute the full experiment metrics for a runExperiment result.
 */
function summarizeExperimentMetrics(exp) {
  const results = (exp && exp.results) || [];
  const byMode = { baseline: [], harness: [] };
  for (const r of results) {
    if (byMode[r.evaluationMode]) byMode[r.evaluationMode].push(r);
  }

  const report = {};
  for (const [mode, rows] of Object.entries(byMode)) {
    if (rows.length) {
      const ai = rows.map((r) => r.score);
      const human = rows.map((r) => r.humanScore);
      report.agreement = report.agreement || {};
      report.agreement[mode] = agreementMetrics(ai, human);
      report.means = report.means || {};
      report.means[mode] = mean(ai);
    }
  }

  report.grounding = groundingMetrics(results);
  report.compliance = complianceMetrics(results);
  if (exp && exp.raterMap) {
    report.interRater = interRaterAggregation(exp.raterMap);
  }

  // Consistency requires repeated runs, which runExperiment() does not
  // automate yet; callers can build it via consistencyMetrics().
  return report;
}


/**
 * Paired baseline-vs-harness comparison.
 *
 * Uses paired observations on the same samples. The primary effect is
 * harnessScore - baselineScore, so positive values mean the harness scores
 * higher. Confidence intervals are deterministic percentile bootstrap CIs;
 * p-value is a paired sign-flip permutation test (exact for small n).
 *
 * This is a research statistic, not a production scoring decision.
 */
function pairedComparison(pairs, opts = {}) {
  const rows = (pairs || []).filter((p) =>
    Number.isFinite(p.baselineScore) && Number.isFinite(p.harnessScore)
  );
  if (!rows.length) return null;

  const baseline = rows.map((p) => Number(p.baselineScore));
  const harness = rows.map((p) => Number(p.harnessScore));
  const deltas = harness.map((v, i) => v - baseline[i]);
  const meanDelta = mean(deltas);
  const medianDelta = median(deltas);
  const deltaStd = std(deltas);
  const effectSize = deltaStd === 0 ? (meanDelta === 0 ? 0 : Infinity) : meanDelta / deltaStd;

  const bootstrapSamples = Math.max(1000, Math.min(20000, Number(opts.bootstrapSamples) || 5000));
  const seed = Number.isFinite(opts.seed) ? opts.seed : 1337;
  const ci = bootstrapMeanDifferenceCI(deltas, bootstrapSamples, seed);

  const maeBaseline = rows
    .filter((p) => Number.isFinite(p.humanScore))
    .map((p) => Math.abs(p.baselineScore - p.humanScore));
  const maeHarness = rows
    .filter((p) => Number.isFinite(p.humanScore))
    .map((p) => Math.abs(p.harnessScore - p.humanScore));

  const pairedMae = maeBaseline.length === maeHarness.length && maeBaseline.length
    ? pairedDifferenceStats(maeBaseline, maeHarness, bootstrapSamples, seed + 1)
    : null;

  return {
    n: rows.length,
    meanDelta,
    medianDelta,
    sdDelta: deltaStd,
    effectSizeCohenDz: effectSize,
    confidenceInterval95: ci,
    permutationPValue: pairedSignFlipPValue(deltas),
    direction: meanDelta > 0 ? "HARNESS_HIGHER" : meanDelta < 0 ? "HARNESS_LOWER" : "NO_MEAN_DIFFERENCE",
    pairedMae: pairedMae
      ? {
          n: pairedMae.n,
          baselineMae: mean(maeBaseline),
          harnessMae: mean(maeHarness),
          meanDelta: pairedMae.meanDelta,
          confidenceInterval95: pairedMae.confidenceInterval95,
          permutationPValue: pairedMae.permutationPValue,
        }
      : null,
  };
}

function median(xs) {
  if (!xs.length) return NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function pairedDifferenceStats(a, b, bootstrapSamples, seed) {
  const deltas = b.map((v, i) => v - a[i]);
  return {
    n: deltas.length,
    meanDelta: mean(deltas),
    confidenceInterval95: bootstrapMeanDifferenceCI(deltas, bootstrapSamples, seed),
    permutationPValue: pairedSignFlipPValue(deltas),
  };
}

function bootstrapMeanDifferenceCI(deltas, samples = 5000, seed = 1337) {
  if (!deltas.length) return null;
  let state = (Math.abs(Math.trunc(seed)) >>> 0) || 1;
  const rand = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const means = new Array(samples);
  for (let b = 0; b < samples; b += 1) {
    let sum = 0;
    for (let i = 0; i < deltas.length; i += 1) {
      sum += deltas[Math.floor(rand() * deltas.length)];
    }
    means[b] = sum / deltas.length;
  }
  means.sort((a, b) => a - b);
  return {
    lower: quantile(means, 0.025),
    upper: quantile(means, 0.975),
    method: "percentile-bootstrap",
    samples,
    seed,
  };
}

function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function pairedSignFlipPValue(deltas) {
  const nonZero = deltas.filter((d) => d !== 0);
  const n = nonZero.length;
  if (n === 0) return 1;
  const observed = Math.abs(mean(nonZero));
  if (n <= 16) {
    const total = 2 ** n;
    let extreme = 0;
    for (let mask = 0; mask < total; mask += 1) {
      let sum = 0;
      for (let i = 0; i < n; i += 1) sum += ((mask >> i) & 1) ? nonZero[i] : -nonZero[i];
      if (Math.abs(sum / n) >= observed - 1e-12) extreme += 1;
    }
    return extreme / total;
  }

  // Deterministic Monte Carlo for larger samples; avoids a hidden RNG dependency.
  const samples = 20000;
  let state = 0x9e3779b9;
  const rand = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  let extreme = 0;
  for (let s = 0; s < samples; s += 1) {
    let sum = 0;
    for (const d of nonZero) sum += rand() < 0.5 ? d : -d;
    if (Math.abs(sum / n) >= observed - 1e-12) extreme += 1;
  }
  return (extreme + 1) / (samples + 1);
}

module.exports = {
  agreementMetrics,
  consistencyMetrics,
  calibrationMetrics,
  groundingMetrics,
  complianceMetrics,
  interRaterAggregation,
  pairedComparison,
  summarizeExperimentMetrics,
};