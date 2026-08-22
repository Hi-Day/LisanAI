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
  return {
    n,
    passRate: count("PASS") / n,
    reviewRate: count("REVIEW") / n,
    failRate: count("FAIL") / n,
  };
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

  // Consistency requires repeated runs, which runExperiment() does not
  // automate yet; callers can build it via consistencyMetrics().
  return report;
}

module.exports = {
  agreementMetrics,
  consistencyMetrics,
  groundingMetrics,
  complianceMetrics,
  summarizeExperimentMetrics,
};