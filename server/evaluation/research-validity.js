const { adjacentAgreement, mae, rmse, expectedCalibrationError, brierScore, calibrationBins } = require("./metrics");

/**
 * Research validity gate.
 *
 * This is a decision-support layer, not a replacement for statistical analysis.
 * It combines human agreement, confidence calibration, evidence validity and
 * repeatability into explicit PASS/REVIEW/INSUFFICIENT states.
 */
function assessResearchValidity({
  aiScores = [],
  humanScores = [],
  confidence = [],
  correctness = [],
  repeatability = null,
  evidenceValidity = null,
  minSamples = 30,
  agreementTolerance = 5,
  maxMae = 10,
  maxEce = 0.10,
  maxBrier = 0.15,
  minAgreement = 0.80,
  minStableRatio = 0.90,
} = {}) {
  const n = Math.min(aiScores.length, humanScores.length);
  const issues = [];
  const metrics = {};

  metrics.n = n;
  metrics.agreement = n ? adjacentAgreement(aiScores.slice(0, n), humanScores.slice(0, n), agreementTolerance) : null;
  metrics.mae = n ? mae(aiScores.slice(0, n), humanScores.slice(0, n)) : null;
  metrics.rmse = n ? rmse(aiScores.slice(0, n), humanScores.slice(0, n)) : null;

  if (n < minSamples) {
    issues.push({
      code: "INSUFFICIENT_HUMAN_REVIEW",
      severity: "REVIEW",
      message: `Only ${n} paired AI-human scores; ${minSamples} are required for a calibration conclusion.`,
    });
  }
  if (metrics.mae != null && metrics.mae > maxMae) {
    issues.push({ code: "HIGH_MAE", severity: "REVIEW", value: metrics.mae, threshold: maxMae });
  }
  if (metrics.agreement != null && metrics.agreement < minAgreement) {
    issues.push({ code: "LOW_HUMAN_AGREEMENT", severity: "REVIEW", value: metrics.agreement, threshold: minAgreement });
  }

  const calN = Math.min(confidence.length, correctness.length);
  metrics.calibrationN = calN;
  metrics.ece = calN ? expectedCalibrationError(confidence.slice(0, calN), correctness.slice(0, calN)) : null;
  metrics.brier = calN ? brierScore(confidence.slice(0, calN), correctness.slice(0, calN)) : null;
  metrics.calibration = calN ? calibrationBins(confidence.slice(0, calN), correctness.slice(0, calN)).bins : [];

  if (calN < minSamples) {
    issues.push({
      code: "INSUFFICIENT_CALIBRATION_DATA",
      severity: "REVIEW",
      message: `Only ${calN} calibration observations; ${minSamples} are required.`,
    });
  }
  if (metrics.ece != null && metrics.ece > maxEce) {
    issues.push({ code: "HIGH_ECE", severity: "REVIEW", value: metrics.ece, threshold: maxEce });
  }
  if (metrics.brier != null && metrics.brier > maxBrier) {
    issues.push({ code: "HIGH_BRIER", severity: "REVIEW", value: metrics.brier, threshold: maxBrier });
  }

  if (evidenceValidity != null && evidenceValidity < 0.95) {
    issues.push({ code: "LOW_EVIDENCE_VALIDITY", severity: "REVIEW", value: evidenceValidity, threshold: 0.95 });
  }

  if (repeatability && repeatability.stableRatio != null && repeatability.stableRatio < minStableRatio) {
    issues.push({
      code: "LOW_REPEATABILITY",
      severity: "REVIEW",
      value: repeatability.stableRatio,
      threshold: minStableRatio,
    });
  }

  const dataSufficient = n >= minSamples && calN >= minSamples;
  const hasReviewIssue = issues.length > 0;
  return {
    status: !dataSufficient ? "INSUFFICIENT" : hasReviewIssue ? "REVIEW" : "PASS",
    conclusion: !dataSufficient
      ? "Evidence belum cukup untuk menyimpulkan calibration/validity model."
      : hasReviewIssue
        ? "Model dapat digunakan sebagai kandidat, tetapi masih memerlukan review atau perbaikan sebelum klaim reliability dibuat."
        : "Metrik memenuhi threshold penelitian yang dikonfigurasi.",
    metrics,
    dataSufficient,
    issues,
    thresholds: {
      minSamples,
      agreementTolerance,
      maxMae,
      maxEce,
      maxBrier,
      minAgreement,
      minStableRatio,
    },
  };
}

module.exports = { assessResearchValidity };
