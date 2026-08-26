const HARNESS_VERSION = "1.0.0";
const ENGINE_VERSION = "1.0.0";

/**
 * Default harness configuration.
 * Change configuration → change harness behavior, no core rewrite.
 */
function defaultConfig(overrides = {}) {
  const defaults = {
    version: HARNESS_VERSION,
    engineVersion: ENGINE_VERSION,
    model: {
      provider: "openrouter",
      model: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
      // Generation parameters (FR-16 / P0). These are recorded in the trace
      // versioning metadata and hashed into configHash so two runs are only
      // reproducible when they used identical sampling settings.
      temperature: Number(process.env.HARNESS_TEMPERATURE ?? 0.25),
      topP: Number(process.env.HARNESS_TOPP ?? 1),
      maxTokens: Number(process.env.HARNESS_MAX_TOKENS ?? 4000),
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
      reliability: flagDefault("HARNESS_RELIABILITY", true),
      output: false, // replaced by canonical output assembly in pipeline
      calibration: false,
      safety: false,
    },
    // P0 evaluation-pipeline optimization flags (PRD §27). Safe defaults: each
    // is OFF unless explicitly enabled, so existing behavior is preserved until
    // a phase is rolled out. Configurable via env or overrides.
    optimization: {
      questionEvaluation: flagDefault("QUESTION_EVALUATION", false),
      partialRetry: flagDefault("PARTIAL_RETRY", false),
      evidenceValidation: flagDefault("EVIDENCE_VALIDATION", false),
      rubricCompiler: flagDefault("RUBRIC_COMPILER", false),
      parallelEvaluation: flagDefault("PARALLEL_EVALUATION", false),
      maxConcurrentEvaluations: Number(
        process.env.MAX_CONCURRENT_EVALUATIONS ?? 3
      ),
      maxQuestionRetries: Number(process.env.MAX_QUESTION_RETRIES ?? 1),
    },
    verification: {
      enabled: true,
      maxRetries: 1,
    },
    scoring: {
      rounding: "half-up", // how final score is rounded
      clamp: true, // keep final score in [0, 100]
    },
  };
  return deepMerge(defaults, overrides || {});
}

/**
 * Recursively merge plain-object overrides into defaults so a partial config
 * (e.g. { model: { temperature: 0.1 } }) preserves the rest of each nested
 * group (provider, model name, topP, maxTokens). Arrays and scalars replace
 * wholesale. Returns a new object; does not mutate inputs.
 */
function deepMerge(base, override) {
  const out = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    const baseValue = base[key];
    if (
      baseValue &&
      typeof baseValue === "object" &&
      !Array.isArray(baseValue) &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      out[key] = deepMerge(baseValue, value);
    } else {
      out[key] = value;
    }
  }
  return out;
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