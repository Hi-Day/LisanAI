function mean(values) {
  const xs = values.filter((value) => Number.isFinite(Number(value))).map(Number);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function absoluteAgreement(predicted, human) {
  if (!Number.isFinite(Number(predicted)) || !Number.isFinite(Number(human))) return null;
  return Math.max(0, 1 - Math.abs(Number(predicted) - Number(human)) / 100);
}

function computeExperimentMetrics(results, humanScores = {}) {
  const rows = (results || []).map(({ condition, result }) => {
    const human = humanScores[condition.id];
    return {
      conditionId: condition.id,
      conditionLabel: condition.label,
      finalScore: result.finalScore,
      humanScore: human ?? null,
      absoluteError: human == null ? null : Math.abs(Number(result.finalScore) - Number(human)),
      agreement: human == null ? null : absoluteAgreement(result.finalScore, human),
      verificationStatus: result.verificationStatus,
      verificationValid: result.verificationValid,
      reliability: result.reliability,
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
    };
  });

  return {
    conditions: rows,
    summary: {
      meanScore: mean(rows.map((r) => r.finalScore)),
      meanAbsoluteError: mean(rows.map((r) => r.absoluteError)),
      meanAgreement: mean(rows.map((r) => r.agreement)),
      verificationPassRate: rows.length ? rows.filter((r) => r.verificationStatus === "PASS").length / rows.length : null,
      humanScoreCoverage: rows.length ? rows.filter((r) => r.humanScore != null).length / rows.length : null,
    },
  };
}

module.exports = { mean, absoluteAgreement, computeExperimentMetrics };
