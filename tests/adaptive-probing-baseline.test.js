const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeProbeResult, prepareProbingPayload } = require("../server/adaptive-probing");

test("adaptive probe preserves baseline score and evidence metadata", () => {
  const payload = prepareProbingPayload({
    answer: "Konsep ini menjelaskan hubungan antar komponen.",
    baselineScore: 62,
    baselineEvidence: ["menjelaskan hubungan antar komponen"],
    baselineEvaluationId: "eval-1",
    baselineEvaluationRunId: "run-1",
  });
  const result = normalizeProbeResult({ prompt: "Mengapa hubungan itu terjadi?" }, payload);
  assert.equal(result.baselineScore, 62);
  assert.deepEqual(result.baselineEvidence, ["menjelaskan hubungan antar komponen"]);
  assert.equal(result.baselineEvaluationId, "eval-1");
  assert.equal(result.baselineEvaluationRunId, "run-1");
});

test("adaptive probe does not invent a baseline", () => {
  const result = normalizeProbeResult({ prompt: "Berikan alasan." }, prepareProbingPayload({ answer: "Jawaban singkat." }));
  assert.equal(result.baselineScore, null);
  assert.deepEqual(result.baselineEvidence, []);
});
