const HARNESS_VERSION = "1.0.0";
const ENGINE_VERSION = "1.0.0";

/**
 * Default harness configuration.
 * Change configuration → change harness behavior, no core rewrite.
 */
function defaultConfig(overrides = {}) {
  return {
    version: HARNESS_VERSION,
    engineVersion: ENGINE_VERSION,
    model: {
      provider: "openrouter",
      model: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
    },
    // Which plugins are active, v1..v3 research modes.
    // Per-plugin feature flags allow rollback without redeploy (PRD §27).
    pipeline: {
      persona: flagDefault("HARNESS_PERSONA", true),
      assessmentContext: flagDefault("HARNESS_CONTEXT", true),
      rubric: true,
      evidence: flagDefault("HARNESS_EVIDENCE", true),
      evaluation: flagDefault("HARNESS_EVALUATION_PLUGIN", true),
      verification: flagDefault("HARNESS_VERIFICATION", true),
      output: false, // replaced by canonical output assembly in pipeline
      calibration: false,
      safety: false,
    },
    verification: {
      enabled: true,
      maxRetries: 1,
    },
    scoring: {
      rounding: "half-up", // how final score is rounded
      clamp: true, // keep final score in [0, 100]
    },
    ...overrides,
  };
}

function validateConfig(config) {
  if (!config) throw new Error("Harness config wajib ada");
  if (!config.model || !config.model.provider) {
    throw new Error("Harness config membutuhkan model.provider");
  }
  if (!Array.isArray(config.pipeline)) {
    // Allow either pipeline array (explicit) or pipeline map (booleans).
    if (!config.plugins && !config.pipeline || (config.pipeline && typeof config.pipeline !== "object")) {
      throw new Error("Harness config membutuhkan plugin mapping (config.pipeline)");
    }
  }
  return config;
}

/**
 * Read a boolean feature flag from the environment with a default.
 * Lets ops disable a harness feature without touching code (PRD §27).
 */
function flagDefault(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v === "1" || /^true$/i.test(v);
}

module.exports = { defaultConfig, validateConfig, HARNESS_VERSION, ENGINE_VERSION, flagDefault };