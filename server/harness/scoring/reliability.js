/**
 * Reliability Engine (PRD FR-10) — computes a reliability vector for an
 * evaluation, separating model confidence from system reliability.
 *
 * The system does NOT rely on a single confidence score. Instead it produces
 * five dimensions:
 *
 *   evidenceGrounding   — fraction of scored criteria with grounded evidence
 *   criterionCoverage   — fraction of rubric criteria that were evaluated
 *   rubricAlignment     — how consistently confidence/score fits the rubric
 *   scoreConsistency    — evidence-backed proportion & score-cell anomalies
 *   outputValidity      — schema compliance of the parsed output
 *
 * then collapses them into `overallReliability`.
 */

const AVERAGE_WEIGHTS = [0.25, 0.2, 0.15, 0.2, 0.2];

/**
 * @param {object} input
 * @param {object[]} input.criteria  criterion-level judgments
 * @param {object[]} input.rubricCriteria  rubric definition criteria
 * @param {object}  input.verification - harness verification result
 * @param {boolean} [input.validOutput] schema-valid parsed output
 * @param {object}  [opts] weights override (must sum to 1)
 * @returns {{eviction...}} reliability vector
 */
function reliabilityVector(input) {
  const criteria = input.criteria || [];
  const rubricIdSet = new Set((input.rubricCriteria || []).map((c) => c.id));
  const verification = input.verification || {};

  const evidenceGrounding = dimensionEvidence(criteria);
  const criterionCoverage = dimensionCriterionCoverage(criteria, rubricIdSet);
  const rubricAlignment = dimensionRubricAlignment(criteria);
  const scoreConsistency = dimensionScoreConsistency(criteria, verification);
  const outputValidity = dimensionOutputValidity(verification, input.valid);

  const dimensions = {
    evidenceGrounding,
    criterionCoverage,
    rubricAlignment,
    scoreConsistency,
    outputValidity,
  };

  const weights = normalizeWeights(input.weights || AVERAGE_WEIGHTS);
  const overallReliability = round(
    weights.reduce((acc, w, i) => acc + w * Object.values(dimensions)[i], 0),
    4
  );

  return { dimensions, overallReliability };
}

function dimensionEvidence(criteria) {
  const scored = criteria.filter((c) => typeof c.score === "number");
  if (scored.length === 0) return 0;
  const grounded = scored.filter(
    (c) => Array.isArray(c.evidence) && (c.noEvidence !== true) && c.evidence.some((ev) => ev && ev.grounded === true)
  );
  return round(grounded.length / scored.length, 4);
}

function dimensionCriterionCoverage(criteria, rubricIds) {
  if (rubricIds.size === 0) {
    return criteria.length > 0 ? 1 : 0;
  }
  let present = 0;
  for (const id of rubricIds) {
    if (criteria.some((c) => c.criterionId === id)) present += 1;
  }
  return round(present / rubricIds.size, 4);
}

/**
 * Rubric alignment — average of per-criterion confidence is used as a proxy
 * surface only; the actual alignment uses rubric-band fit when available.
 * For the initial engine we compute the mean of confidence values (clamped).
 */
function dimensionRubricAlignment(criteria) {
  const confidences = criteria
    .map((c) => (typeof c.confidence === "number" ? clamp01(c.confidence) : null))
    .filter((v) => v !== null);
  if (confidences.length === 0) return 0;
  return round(confidences.reduce((a, b) => a + b, 0) / confidences.length, 4);
}

/**
 * Score-evidence consistency — a blend of coverage and the fraction of
 * criteria whose score is plausible relative to their grounded evidence.
 */
function dimensionScoreConsistency(criteria, verification) {
  const scored = criteria.filter((c) => typeof c.score === "number");
  if (scored.length === 0) return 0;
  let plausible = 0;
  const highThreshold = 80;
  for (const c of scored) {
    const hasGrounded = Array.isArray(c.evidence) && c.evidence.some((ev) => ev && ev.grounded === true);
    const lowEvidence = !hasGrounded && c.noEvidence === true;
    if (lowEvidence && c.score >= highThreshold) continue; // implausible
    plausible += 1;
  }
  const coverage = verification.scoreConsistency
    ? verification.scoreConsistency.coverage
    : null;
  const scoreDim = round(plausible / scored.length, 4);
  if (coverage === null) return scoreDim;
  return round((scoreDim + coverage) / 2, 4);
}

function dimensionOutputValidity(verification, validFlag) {
  if (typeof validFlag === "boolean") return validFlag ? 1 : 0;
  if (verification && typeof verification.valid === "boolean") return verification.valid ? 1 : 0;
  return 0;
}

function normalizeWeights(weights) {
  const arr = (Array.isArray(weights) ? weights : AVERAGE_WEIGHTS).map(Number);
  const sum = arr.reduce((a, b) => a + b, 0);
  if (!sum || !Number.isFinite(sum)) return AVERAGE_WEIGHTS;
  return arr.map((w) => w / sum);
}

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function round(v, places = 4) {
  const f = 10 ** places;
  return Math.round((v + Number.EPSILON) * f) / f;
}

module.exports = { reliabilityVector };