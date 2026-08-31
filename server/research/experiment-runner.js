const crypto = require("node:crypto");
const { evaluateAssessment } = require("../evaluation/evaluation-service");

const DEFAULT_CONDITIONS = [
  { id: "baseline", label: "LLM baseline", harness: { rubric: false, evidence: false, verification: false, reliability: false, risk: false } },
  { id: "rubric", label: "Rubric", harness: { rubric: true, evidence: false, verification: false, reliability: false, risk: false } },
  { id: "rubric-evidence", label: "Rubric + Evidence", harness: { rubric: true, evidence: true, verification: false, reliability: false, risk: false } },
  { id: "rubric-evidence-verification", label: "Rubric + Evidence + Verification", harness: { rubric: true, evidence: true, verification: true, reliability: false, risk: false } },
  { id: "full-harness", label: "Full Harness", harness: { rubric: true, evidence: true, verification: true, reliability: true, risk: true } },
];

function createExperimentId() {
  return `exp_${crypto.randomBytes(6).toString("hex")}`;
}

function normalizeConditions(conditions) {
  return (conditions || DEFAULT_CONDITIONS).map((condition) => ({
    id: condition.id,
    label: condition.label || condition.id,
    harness: { ...(condition.harness || {}) },
  }));
}

function summarizeResult(result) {
  const verification = result.verification || {};
  const reliability = result.reliability || {};
  return {
    evaluationRunId: result.evaluationRunId,
    finalScore: result.finalScore,
    published: result.published,
    requiresHumanReview: result.requiresHumanReview,
    verificationStatus: verification.status || null,
    verificationValid: verification.valid ?? null,
    reliability: reliability.overallReliability ?? null,
    riskScore: result.risk ? result.risk.score : null,
    riskLevel: result.risk ? result.risk.level : null,
    rubricVersion: result.versioning ? result.versioning.rubricVersion : null,
    harnessVersion: result.versioning ? result.versioning.harnessVersion : null,
    harnessManifest: result.harnessManifest || null,
  };
}

/**
 * Run the same assessment input under controlled harness configurations.
 * The runner deliberately returns compact summaries plus run identifiers;
 * detailed traces remain owned by the evaluation/research persistence layer.
 */
async function runExperiment({ experimentId = createExperimentId(), name = "Harness ablation", input, conditions } = {}) {
  if (!input || !Array.isArray(input.answers)) throw new Error("experiment input harus berisi answers array");
  const selected = normalizeConditions(conditions);
  const startedAt = new Date().toISOString();
  const results = [];

  for (const condition of selected) {
    const result = await evaluateAssessment({
      ...input,
      harnessConfig: {
        ...(input.harnessConfig || {}),
        pipeline: {
          ...((input.harnessConfig && input.harnessConfig.pipeline) || {}),
          ...condition.harness,
        },
      },
    });
    results.push({ condition: { id: condition.id, label: condition.label }, result: summarizeResult(result) });
  }

  return {
    experimentId,
    name,
    startedAt,
    finishedAt: new Date().toISOString(),
    conditions: selected,
    results,
  };
}

module.exports = { DEFAULT_CONDITIONS, createExperimentId, runExperiment, summarizeResult };
