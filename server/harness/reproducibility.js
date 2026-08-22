const crypto = require("node:crypto");

/**
 * Reproducibility hashing (PRD FR-15).
 *
 * Two evaluation runs are reproducible only when they consumed identical
 * input, prompt, rubric and configuration. We compute stable, canonical
 * hashes for each of those surfaces so a trace can prove "same config"
 * without shipping the full inputs around.
 *
 * Hashes are deterministic for equal input: keys are sorted, JSON is
 * serialized compactly, and the digest is a short hex SHA-256.
 */
function sha256(value) {
  return crypto.createHash("sha256").update(canonical(value)).digest("hex");
}

/** Canonical, deterministic serialization (sorted keys, no whitespace). */
function canonical(value) {
  if (value === undefined || value === null) return JSON.stringify(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const keys = Object.keys(value).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",");
  return `{${body}}`;
}

/**
 * FR-15/FR-14 — build all reproducibility hashes for an evaluation run.
 *
 * @param {object} parts
 * @param {array}  parts.answers          student answers (the input surface)
 * @param {object|null} [parts.rubric]    rubric definition
 * @param {string|object|null} [parts.prompt]  effective prompt sent to the model
 * @param {object} [parts.config]         effective harness config
 * @returns {{ inputHash, rubricHash, promptHash, configHash, hashingMethod }}
 */
function buildReproducibilityHashes({ answers, rubric, prompt, config } = {}) {
  return {
    inputHash: sha256({ answers }),
    rubricHash: sha256(rubric),
    promptHash: sha256(prompt),
    configHash: sha256(config),
    hashingMethod: "sha256",
  };
}

module.exports = { sha256, canonical, buildReproducibilityHashes };