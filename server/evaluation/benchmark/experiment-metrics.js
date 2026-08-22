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

module.exports = {
  agreementMetrics,
  consistencyMetrics,
  groundingMetrics,
  complianceMetrics,
  interRaterAggregation,
  summarizeExperimentMetrics,
};