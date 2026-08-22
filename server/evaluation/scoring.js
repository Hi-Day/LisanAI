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
      // Human-readable label for trace display (name wins, else a prettified id)
      label: def.label || def.name || prettifyId(criterion.criterionId),
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
    formula: detail.map((d) => `${prettifyId(d.criterionId)} (${d.score} × ${pct(d.weight)})`).join(" + "),
  };
}

/** Turn a slug criterionId like "ketepatan_konsep_arsitektur_30" into readable text. */
function prettifyId(id) {
  return String(id || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\d{2,3}\b/g, "") // drop trailing/embedded weight numbers like "_30"
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format a weight (0-1) as an integer percent for display. */
function pct(weight) {
  const v = Math.round((Number(weight) || 0) * 100);
  return `${v}%`;
}

function round(value, places = 2) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = { calculateFinalScore, round, clamp };