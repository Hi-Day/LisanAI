const fs = require("node:fs");
const path = require("node:path");
const { ROOT } = require("../../config");

/**
 * PRD FR-13 (Research Dataset) — dataset schema + loader.
 *
 * A dataset is an array of samples with the canonical shape:
 * {
 *   sampleId, question, rubric, studentAnswer, humanScore,
 *   humanCriterionScores?, humanFeedback?, annotatorId?
 * }
 *
 * Datasets are JSON files under data/datasets/. A `dataset.json` may also
 * declare `version` and `metadata` at the top level; the loader normalizes
 * both inline-array and { version, samples[] } shapes.
 */

const DATASET_DIR = path.join(ROOT, "data", "datasets");

/**
 * Resolve the path for a dataset by name (or explicit path).
 */
function resolveDatasetPath(nameOrPath) {
  if (path.isAbsolute(nameOrPath)) return nameOrPath;
  return path.join(DATASET_DIR, `${nameOrPath}.json`);
}

/**
 * Load a dataset from disk, normalized to an array of samples.
 * Accepts: { version, metadata, samples } | [ ...samples ].
 * [PRD §21, §34: reproducibility requires dataset version recording.]
 */
function loadDataset(nameOrPath, opts = {}) {
  const file = resolveDatasetPath(nameOrPath);
  if (!fs.existsSync(file)) {
    throw new Error(`Dataset tidak ditemukan: ${file}`);
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`Dataset tidak valid JSON: ${e.message}`);
  }
  const samples = Array.isArray(raw) ? raw : raw.samples;
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new Error("Dataset harus memuat array samples yang tidak kosong");
  }
  return {
    version: (raw && raw.version) || (opts.version || "v1"),
    metadata: (raw && raw.metadata) || {},
    samples,
    file,
  };
}

/**
 * Validate that a dataset sample meets the minimal FR-21 schema.
 * Returns { valid, errors }.
 */
function validateSample(sample, idx) {
  const errors = [];
  if (!sample) {
    errors.push(`sample[${idx}] null`);
    return { valid: false, errors };
  }
  if (!sample.question) errors.push(`sample[${idx}] question wajib`);
  if (!sample.studentAnswers || !Array.isArray(sample.studentAnswers) || sample.studentAnswers.length === 0) {
    errors.push(`sample[${idx}] studentAnswers wajib non-empty array`);
  }
  if (!sample.rubric || !Array.isArray(sample.rubric.criteria) || sample.rubric.criteria.length === 0) {
    errors.push(`sample[${idx}] rubric.criteria wajib non-empty`);
  }
  if (typeof sample.humanScore === "number" && (sample.humanScore < 0 || sample.humanScore > 100)) {
    errors.push(`sample[${idx}] humanScore di luar [0,100]`);
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate an entire dataset (all samples).
 * @returns { { valid, total, invalidCount, errors } }
 */
function validateDataset(samples) {
  const allErrors = [];
  let invalidCount = 0;
  samples.forEach((s, idx) => {
    const r = validateSample(s, idx);
    if (!r.valid) {
      invalidCount += 1;
      allErrors.push(...r.errors.map((e) => `sample[${idx}]:${e}`));
    }
  });
  return { valid: invalidCount === 0, total: samples.length, invalidCount, errors: allErrors };
}

module.exports = {
  DATASET_DIR,
  loadDataset,
  validateSample,
  validateDataset,
};