const assert = require("node:assert/strict");
const { loadDataset, validateDataset } = require("../server/evaluation/benchmark/dataset");

const datasetName = "lisanai-calibration-v1";
const dataset = loadDataset(datasetName);
const validation = validateDataset(dataset.samples);

console.log("\n========== LisanAI LLM Judge Calibration Fixture ==========");
console.log("Mode: OFFLINE FIXTURE CHECK (no model/API call)");
console.log("Purpose: expose reference cases and expected scores in build logs.");
console.log("Important: this does NOT measure live LLM Judge score deviation.");
console.log(`Dataset: ${datasetName} | samples: ${dataset.samples.length} | version: ${dataset.version || "unspecified"}`);
console.log(`Schema validation: ${validation.valid ? "PASS" : "FAIL"} | invalid: ${validation.invalidCount || 0}`);

assert.equal(validation.valid, true, JSON.stringify(validation));
assert.equal(dataset.samples.length, 12, "Expected 12 calibration cases");

const referenceScores = dataset.samples.map((sample) => {
  assert.ok(Number.isFinite(sample.humanScore), `Missing reference score: ${sample.sampleId}`);
  const weightSum = sample.rubric.criteria.reduce((sum, criterion) => sum + Number(criterion.weight || 0), 0);
  assert.ok(Math.abs(weightSum - 1) < 0.001, `Rubric weights must sum to 1: ${sample.sampleId}`);
  return sample.humanScore;
});

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const meanReferenceScore = mean(referenceScores);
const cases = dataset.samples.map((sample) => ({
  sampleId: sample.sampleId,
  label: sample.caseLabel,
  referenceScore: sample.humanScore,
  answerChars: String(sample.studentAnswers?.[0] ?? "").length,
}));

console.log("Cases:");
for (const item of cases) {
  console.log(`  ${item.sampleId} | reference=${String(item.referenceScore).padStart(3)} | ${item.label} | answerChars=${item.answerChars}`);
}
console.log(`Reference-score mean: ${meanReferenceScore.toFixed(2)} / 100`);
console.log("Result: PASS — calibration fixture is valid and available for subsequent evaluation.");
console.log("===========================================================\n");
