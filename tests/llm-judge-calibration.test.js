const assert = require("node:assert/strict");
const test = require("node:test");
const { loadDataset, validateDataset } = require("../server/evaluation/benchmark/dataset");
const { runExperiment } = require("../server/evaluation/benchmark/benchmark");

const DATASET = "lisanai-calibration-v1";
const MAX_MAE_POINTS = 5;

test("LLM Judge calibration dataset covers a useful score range and answer styles", () => {
  const ds = loadDataset(DATASET);
  assert.equal(ds.samples.length, 12);
  assert.equal(validateDataset(ds.samples).valid, true);
  assert.ok(ds.samples.some((s) => s.humanScore >= 90 && s.studentAnswers[0].length > 0),
    "must include strong correct answers");
  assert.ok(ds.samples.some((s) => s.humanScore <= 15), "must include incorrect/blank answers");
  assert.ok(ds.samples.some((s) => /parafrasa/i.test(s.caseLabel)), "must include a paraphrase case");
  assert.ok(ds.samples.some((s) => /singkat/i.test(s.caseLabel)), "must include a concise correct answer");
  assert.ok(ds.samples.every((s) => s.rubric.criteria.reduce((sum, c) => sum + c.weight, 0) > 0.999),
    "each rubric must have normalized positive weights");
});

test("live LLM Judge mean absolute score deviation is at most 5 points", {
  skip: process.env.RUN_LLM_CALIBRATION !== "true"
    ? "Set RUN_LLM_CALIBRATION=true and OPENROUTER_API_KEY to run the paid live-model calibration gate."
    : false,
}, async () => {
  assert.ok(
    process.env.OPENROUTER_API_KEY &&
    process.env.OPENROUTER_API_KEY !== "mock-key" &&
    !process.env.OPENROUTER_API_KEY.includes("your_api_key"),
    "OPENROUTER_API_KEY must be configured for a real model run"
  );

  process.env.HARNESS_PROVIDER = "openrouter";
  const experiment = await runExperiment({
    dataset: DATASET,
    mode: ["harness"],
    providerName: "openrouter",
    repeats: 1,
  });
  assert.equal(experiment.validation.valid, true, JSON.stringify(experiment.validation));

  const rows = experiment.results.filter((r) =>
    r.evaluationMode === "harness" && Number.isFinite(r.score) && Number.isFinite(r.humanScore)
  );
  assert.equal(rows.length, 12, "all calibration cases must produce a numeric score");

  const errors = rows.map((r) => r.score - r.humanScore);
  const mae = errors.reduce((sum, error) => sum + Math.abs(error), 0) / errors.length;
  const meanBias = errors.reduce((sum, error) => sum + error, 0) / errors.length;
  console.log("[LLM calibration]", JSON.stringify({
    dataset: DATASET,
    n: rows.length,
    mae: Number(mae.toFixed(2)),
    meanBias: Number(meanBias.toFixed(2)),
    maxAllowedMae: MAX_MAE_POINTS,
    cases: rows.map((r) => ({
      sampleId: r.sampleId,
      expected: r.humanScore,
      actual: r.score,
      error: r.score - r.humanScore,
    })),
  }, null, 2));

  assert.ok(
    mae <= MAX_MAE_POINTS,
    `LLM Judge calibration failed: MAE=${mae.toFixed(2)} points; maximum allowed is ${MAX_MAE_POINTS}. Mean bias=${meanBias.toFixed(2)}.`
  );
});
