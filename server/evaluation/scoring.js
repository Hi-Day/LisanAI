const { validateRubric } = require("../harness/validator");

const ROUND_PLACES = 2;

function calculateFinalScore(criteria, rubric) {
  // Historical strict contract: invalid/empty rubrics and unknown criteria are
  // hard errors. The strict checks here preserve existing behavior; the math is
  // delegated to the lenient authority (computeFinalScore).
  const rubricCheck = validateRubric(rubric);
  if (!rubricCheck.valid) {
    throw new Error(`Rubric invalid: ${rubricCheck.issues.join("; ")}`);
  }

  const byId = new Map(rubric.criteria.map((c) => [String(c.id), c]));
  // A model may hallucinate a criterion that is NOT in the rubric. Scoring is
  // the deterministic authority — it must never be blocked by such noise, and
  // it must never let an invented criterion influence the score. Filter them
  // out and continue; computeFinalScore already treats unknown criteria as
  // excluded (not invented), so this only makes the strict wrapper consistent.
  const knownCriteria = [];
  const unknownProvided = [];
  for (const criterion of criteria) {
    if (byId.get(String(criterion.criterionId))) knownCriteria.push(criterion);
    else unknownProvided.push(criterion.criterionId);
  }
  if (unknownProvided.length > 0) {
    console.warn(`[scoring] Membuang criterion di luar rubrik (hallucination): ${unknownProvided.join(", ")}`);
  }

  const result = computeFinalScore({
    criteria: knownCriteria,
    rubric,
    options: { renormalize: false },
  });

  return {
    finalScore: result.finalScore,
    weighted: result.weighted,
    detail: result.detail,
    formula: result.detail
      .map((d) => `${prettifyId(d.criterionId)} (${d.score} × ${pct(d.weight)})`)
      .join(" + "),
  };
}

const DEFAULT_OPTIONS = {
  // Renormalize effective weights over the applicable criterion subset (a
  // per-question / aligned set) so it always sums to 1 and stays on 0-100.
  renormalize: true,
  excludedCriterionIds: [],
};

/**
 * THE deterministic, pure scoring authority.
 *
 * Computes finalScore exclusively from criterion scores × effective rubric
 * weights. It never accepts a model-provided finalScore as input, never invents
 * missing criteria, and always reports completeness/coverage.
 *
 * @param {object} input
 * @param {object[]} input.criteria          [{ criterionId, score(0-100) }]
 * @param {object | object[]} input.rubric   { criteria: [{ id, name?, weight }] } or array
 * @param {object} [input.options]
 * @param {boolean} [input.options.renormalize=true] rescale effective weights to sum to 1
 *                                                      over the applicable subset
 * @param {string[]} [input.options.excludedCriterionIds=[]] criteria intentionally unmeasured
 * @returns {{
 *   finalScore: number,
 *   weighted: number,
 *   detail: Array<{criterionId,label,weight,rawWeight,score,contribution}>,
 *   method: "weighted-mean"|"weighted-mean-raw"|"none",
 *   excludedCriterionIds: string[],
 *   hasCompleteCriteria: boolean,
 *   missingCriterionIds: string[],
 * }}
 */
function computeFinalScore({ criteria, rubric, options = {} }) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const rubricCriteria = normalizeRubric(rubric); // throws on invalid/empty

  if (!Array.isArray(criteria)) {
    throw new Error("criteria harus berupa array");
  }

  // Validate every rubric weight up-front (non-finite/negative is a hard error,
  // never silently clamped).
  for (const c of rubricCriteria) {
    if (!Number.isFinite(c.weight) || c.weight < 0) {
      throw new Error(`Criterion '${c.id}' memiliki weight yang tidak valid (${c.weight})`);
    }
  }

  const rubricById = new Map(rubricCriteria.map((c) => [String(c.id), c]));
  const excludedOpt = new Set((opts.excludedCriterionIds || []).map((e) => String(e)));

  const providedIds = new Set(); // rubric criteria that appear in `criteria`
  const detail = [];
  const unknownProvided = [];

  for (const item of criteria) {
    const id = String(item == null ? "" : item.criterionId || "").trim();
    if (!id) throw new Error("Setiap kriteria wajib memiliki criterionId");
    const def = rubricById.get(id);
    if (!def) {
      // Unknown to the rubric: cannot be scored, reported — never invented.
      unknownProvided.push(id);
      continue;
    }
    const score = safeScore(item.score); // throws on non-numeric, clamps 0-100
    providedIds.add(id);
    if (excludedOpt.has(id)) continue; // intentionally unmeasured: not scored
    detail.push({
      criterionId: id,
      label: def.label || def.name || prettifyId(id),
      rawWeight: def.weight,
      weight: def.weight,
      score,
      contribution: 0,
    });
  }

  const excludedRubric = rubricCriteria
    .filter((c) => excludedOpt.has(String(c.id)))
    .map((c) => String(c.id));
  const excludedCriterionIds = [...new Set([...excludedRubric, ...unknownProvided])];

  const usable = detail.filter((d) => Number(d.rawWeight || 0) > 0);
  const rawSubsetSum = usable.reduce((acc, d) => acc + Number(d.rawWeight || 0), 0);

  if (usable.length === 0) {
    return {
      finalScore: 0,
      weighted: 0,
      detail: [],
      method: "none",
      excludedCriterionIds,
      hasCompleteCriteria: false,
      missingCriterionIds: rubricCriteria
        .filter((c) => !providedIds.has(String(c.id)) && !excludedOpt.has(String(c.id)))
        .map((c) => String(c.id)),
    };
  }

  const renormalizeApplied =
    opts.renormalize !== false && Math.abs(rawSubsetSum - 1) > 1e-9;
  const scale = renormalizeApplied ? 1 / rawSubsetSum : 1;

  let weighted = 0;
  for (const d of usable) {
    const effWeight = Number(d.rawWeight) * scale;
    d.weight = renormalizeApplied ? effWeight : d.rawWeight;
    d.contribution = round(effWeight * d.score, 4);
    weighted += effWeight * d.score;
  }

  weighted = round(weighted, 10);
  const finalScore = clamp(round(weighted, ROUND_PLACES), 0, 100);

  const missingCriterionIds = rubricCriteria
    .filter((c) => !providedIds.has(String(c.id)) && !excludedOpt.has(String(c.id)))
    .map((c) => String(c.id));

  const method =
    renormalizeApplied || excludedRubric.length > 0 ? "weighted-mean" : "weighted-mean-raw";

  return {
    finalScore,
    weighted,
    detail,
    method,
    excludedCriterionIds,
    hasCompleteCriteria: missingCriterionIds.length === 0,
    missingCriterionIds,
  };
}

/**
 * Normalize the rubric into an array of { id, name, label, weight }.
 * Throws when there is no non-empty criteria list (nothing to compute without a
 * reference). Weight NaN/negative is validated by computeFinalScore.
 */
function normalizeRubric(rubric) {
  const list = Array.isArray(rubric) ? rubric : rubric && rubric.criteria;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("Rubric tidak valid: wajib memiliki array criteria non-empty");
  }
  const out = list.map((c, i) => {
    const src = c || {};
    return {
      id: String(src.id || src.criterionId || `k${i + 1}`),
      name: String(src.name || src.label || `Kriteria ${i + 1}`).trim(),
      label: String(src.label || ""),
      weight: src.weight == null ? 0 : Number(src.weight),
    };
  });
  for (const c of out) {
    if (!c.id) throw new Error("Setiap criterion rubric wajib punya id");
  }
  return out;
}

/**
 * Validate + clamp a criterion score.
 * - Non-finite / NaN / non-numeric   -> throw (validation error).
 * - Numeric outside [0, 100]         -> clamped (preserve existing semantics).
 */
function safeScore(value) {
  // Unlike bare Number(), null/undefined/empty must not coerce to 0 — a missing
  // score is a validation error, not a silent zero.
  if (value == null || value === "" || value === true || value === false) {
    throw new Error(`Skor criterion tidak valid: ${JSON.stringify(value)}`);
  }
  const score = Number(value);
  if (!Number.isFinite(score)) {
    throw new Error(`Skor criterion tidak valid: ${JSON.stringify(value)}`);
  }
  return clamp(score, 0, 100);
}

/** Turn a slug criterionId like "ketepatan_konsep_arsitektur_30" into readable text. */
function prettifyId(id) {
  return String(id || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\d{2,3}\b/g, "")
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

module.exports = {
  calculateFinalScore,
  computeFinalScore,
  round,
  clamp,
  normalizeRubric,
};