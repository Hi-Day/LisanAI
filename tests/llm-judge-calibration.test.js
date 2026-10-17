const assert = require("node:assert/strict");
const test = require("node:test");
const { loadDataset, validateDataset } = require("../server/evaluation/benchmark/dataset");

const DATASET = "lisanai-calibration-v1";

test("LLM Judge calibration fixture is complete and ready for a model run", () => {
  const ds = loadDataset(DATASET);
  assert.equal(ds.samples.length, 12);
  assert.equal(validateDataset(ds.samples).valid, true);
  assert.ok(ds.samples.some((s) => s.humanScore >= 90 && s.studentAnswers[0].length > 0),
    "must include strong correct answers");
  assert.ok(ds.samples.some((s) => s.humanScore <= 15), "must include incorrect/blank answers");
  assert.ok(ds.samples.some((s) => /parafrasa/i.test(s.caseLabel)), "must include a paraphrase case");
  assert.ok(ds.samples.some((s) => /singkat/i.test(s.caseLabel)), "must include a concise correct answer");
  assert.ok(ds.samples.every((s) => Math.abs(s.rubric.criteria.reduce((sum, c) => sum + c.weight, 0) - 1) < 0.001),
    "each rubric must have normalized weights summing to 1");
});
