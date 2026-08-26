const crypto = require("node:crypto");
const { parseRubricText } = require("./plugins/rubric");

/**
 * Rubric Compiler (PRD P0-1)
 *
 * Converts every supported rubric input form into a single canonical,
 * immutable, versioned representation. The compiled rubric is computed ONCE
 * before any student evaluation starts; it is never re-interpreted during
 * question-level evaluation.
 *
 * Supported inputs:
 *   1. structured rubric   { criteria: [{ id?, name, description?, weight }] }
 *   2. free-text rubric    "Akurasi 40%, Kelengkapan 60%"
 *   3. fallback rubric     (no rubric at all) -> uniform single criterion
 *
 * Canonical output:
 *   {
 *     id: "rubric-<sha8>",
 *     version: "v1",
 *     hash: "<sha256>",
 *     criteria: [{ id, name, description, weight }]  // frozen; weights sum to 1
 *   }
 */

const RUBRIC_VERSION = "v1";

/**
 * Deterministic slug for a criterion id from its name. Collision-safe by
 * suffixing a counter when a name maps to the same slug within one rubric.
 */
function slugify(name) {
  const slug = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "criterion";
}

function canonicalHash(value) {
  return crypto.createHash("sha256").update(canonicalStringify(value)).digest("hex");
}

/**
 * Deterministic, key-sorted JSON serialization so two structurally-equal
 * rubrics always hash identically regardless of key insertion order.
 */
function canonicalStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(value[k])}`).join(",");
  return `{${body}}`;
}

/**
 * Normalize + validate a single criterion entry.
 * @returns {{id,name,description,weight}} or throws on invalid weight/id.
 */
function normalizeCriterion(entry, index, seenIds) {
  const src = entry || {};
  const name = String(src.name || src.label || "").trim();
  const rawWeight = src.weight == null ? 0 : Number(src.weight);

  if (!name) {
    throw new Error(`Criterion #${index + 1} wajib memiliki nama`);
  }
  if (!Number.isFinite(rawWeight)) {
    throw new Error(`Criterion '${name}' memiliki weight yang tidak valid (${src.weight})`);
  }
  if (rawWeight < 0) {
    throw new Error(`Criterion '${name}' memiliki weight negatif (${rawWeight})`);
  }

  const explicit = !!(src.id || src.criterionId);
  let id = String(src.id || src.criterionId || slugify(name)).trim();
  if (!id) id = slugify(name);
  // Deterministic id normalization.
  id = id.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || slugify(name);

  // Explicit duplicate ids are rejected (PRD: duplicate criteria ditolak).
  if (explicit && seenIds.has(id)) {
    throw new Error(`Criterion id duplikat: '${id}'`);
  }
  // Derived ids that collide (two different names normalizing to the same slug)
  // are made distinct deterministically rather than throwing.
  if (seenIds.has(id)) {
    let base = id;
    let counter = 1;
    while (seenIds.has(id)) id = `${base}${counter++}`;
  }
  seenIds.add(id);

  return {
    id,
    name,
    description: String(src.description || src.desc || "").trim(),
    weight: rawWeight,
  };
}

/**
 * Build criteria from a free-text rubric string.
 */
function criteriaFromFreeText(text) {
  const parsed = parseRubricText(text); // returns [{ id, name, weight(0-1), scale }]
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Free-text rubric tidak menghasilkan kriteria");
  }
  return parsed.map((c) => ({ name: c.name, weight: c.weight }));
}

/**
 * Resolve the raw criteria list (structured | free-text | fallback) and
 * normalize to { name, weight } pairs before id-assignment + weight checks.
 */
function resolveCriteria(rubric) {
  // Structured rubric: object with .criteria array.
  if (rubric && typeof rubric === "object" && !Array.isArray(rubric) && Array.isArray(rubric.criteria)) {
    return rubric.criteria;
  }
  // Free-text rubric string.
  if (typeof rubric === "string" && String(rubric).trim()) {
    return criteriaFromFreeText(rubric);
  }
  // Array of criteria directly.
  if (Array.isArray(rubric)) {
    return rubric;
  }
  // Fallback rubric: no usable input -> single uniform criterion.
  return [{ name: "Penilaian Keseluruhan", weight: 1 }];
}

/**
 * Validate + normalize weights to sum to 1.
 * - Zero weight is allowed for an individual criterion but it cannot be the
 *   only one with weight.
 * - After normalization the total is 1 (within FP tolerance).
 */
function normalizeWeights(criteria) {
  const total = criteria.reduce((acc, c) => acc + c.weight, 0);
  if (!(total > 0)) {
    throw new Error("Rubric harus memiliki total weight > 0");
  }
  return criteria.map((c) => ({
    ...c,
    weight: roundWeight(c.weight / total),
  }));
}

function roundWeight(w) {
  return Math.round(w * 1e9) / 1e9;
}

/**
 * Compile any supported rubric into its canonical, immutable form.
 * @param {object} input
 * @param {object|string|array|null} input.rubric  raw rubric
 * @param {string} [input.id]  caller-provided rubric id (defaults to derived)
 * @returns {{id, version, hash, criteria}}
 */
function compileRubric({ rubric, id } = {}) {
  const rawCriteria = resolveCriteria(rubric);

  const seenIds = new Set();
  const normalized = rawCriteria.map((c, i) => normalizeCriterion(c, i, seenIds));

  // Duplicate detection happens in normalizeCriterion via seenIds.
  const weighted = normalizeWeights(normalized);

  // A zero-weight criterion is permitted but must not be the sole contributor.
  const nonZero = weighted.filter((c) => c.weight > 0);
  if (nonZero.length === 0) {
    throw new Error("Rubric tidak memiliki kriteria berbobot > 0");
  }

  // Hash is computed over criteria SORTED BY ID so that a semantically-identical
  // rubric hashes the same regardless of the order criteria were declared in.
  const hash = canonicalHash({
    version: RUBRIC_VERSION,
    criteria: [...weighted]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((c) => ({ id: c.id, name: c.name, description: c.description, weight: c.weight })),
  });
  const compiledId = id || `rubric-${hash.slice(0, 8)}`;

  // Immutable: freeze the criteria so no downstream code can mutate them.
  const frozen = Object.freeze({
    id: compiledId,
    version: RUBRIC_VERSION,
    hash,
    criteria: Object.freeze(weighted.map((c) => Object.freeze({ ...c }))),
  });

  return frozen;
}

/** Deterministic hash for a rubric (independent of compile id). */
function rubricHash(rubric) {
  const compiled = compileRubric({ rubric });
  return compiled.hash;
}

module.exports = {
  compileRubric,
  rubricHash,
  canonicalStringify,
  RUBRIC_VERSION,
};
