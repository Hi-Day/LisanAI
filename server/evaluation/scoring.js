const { validateRubric } = require("../harness/validator");

/**
 * Deterministic, server-side final score calculation.
 * The LLM produces criterion scores; the server computes the weighted final.
 *
 *   Final Score = Σ (criterionScore × criterionWeight)
 */
function calculateFinalScore(criteria, rubric) {
  const rubricCheck = validateRubric(rubric);
  if (!rubricCheck.valid) {
    throw new Error(`Rubric invalid: ${rubricCheck.issues.join("; ")}`);
  }

  const byId = new Map(rubric.criteria.map((c) => [c.id, c]));
  let weighted = 0;
  const detail = [];

  for (const criterion of criteria) {
    const def = byId.get(criterion.criterionId);
    if (!def) {
      throw new Error(`Criterion '${criterion.criterionId}' tidak ada di rubric`);
    }
    const score = clamp(criterion.score, 0, 100);
    const contribution = score * def.weight;
    weighted += contribution;
    detail.push({
      criterionId: criterion.criterionId,
      weight: def.weight,
      score,
      contribution: round(contribution, 4),
    });
  }

  // Optional: penalize missing criteria by treating them as 0 implicitly
  // because unknown criteria are ignored (all criteria must be present).
  const finalRaw = weighted;
  const finalScore = round(finalRaw, 2);
  return {
    finalScore,
    weighted,
    detail,
    formula: detail.map((d) => `${d.criterionId}.${d.score}*${d.weight}`).join(" + "),
  };
}

function round(value, places = 2) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = { calculateFinalScore, round, clamp };