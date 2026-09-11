const test = require("node:test");
const assert = require("node:assert/strict");
const {
  inferRequiredEvidence,
  measureEvidenceQuality,
  signalDimensions,
} = require("../server/evidence-quality");

test("detects evidence signals transparently", () => {
  const types = signalDimensions("Konsep ini terjadi karena perubahan energi, misalnya pada kasus sederhana.");
  assert.deepEqual(types, ["conceptual_clarity", "causal_reasoning", "application"]);
});

test("infers required evidence from question criteria", () => {
  const required = inferRequiredEvidence({
    text: "Jelaskan konsep dan mengapa hasilnya demikian. Berikan contoh penerapan.",
  }).map((item) => item.type);
  assert.deepEqual(required, ["conceptual_clarity", "causal_reasoning", "application"]);
});

test("measures missing evidence and targeted probe gain", () => {
  const result = measureEvidenceQuality(
    { text: "Jelaskan konsep dan mengapa hasilnya demikian. Berikan contoh penerapan." },
    {
      answer: "Konsep ini menjelaskan perubahan energi.",
      score: 81,
      probing: {
        status: "accepted",
        evidenceGap: { type: "causal_reasoning" },
        baselineScore: 62,
        answer: "Hal itu terjadi karena energi berpindah dalam proses tersebut.",
      },
    }
  );

  assert.deepEqual(result.initial.present, ["conceptual_clarity"]);
  assert.deepEqual(result.initial.missing, ["causal_reasoning", "application"]);
  assert.equal(result.probe.target, "causal_reasoning");
  assert.equal(result.probe.coverageGain, 1);
  assert.deepEqual(result.final.present, ["conceptual_clarity", "causal_reasoning"]);
  assert.equal(result.final.coverage, 2 / 3);
  assert.equal(result.impact.baselineScore, 62);
  assert.equal(result.impact.verifiedScore, 81);
  assert.equal(result.impact.scoreDelta, 19);
  assert.equal(result.impact.evidenceGain, 1);
});

test("irrelevant probe does not create evidence gain", () => {
  const result = measureEvidenceQuality(
    { text: "Jelaskan konsep dan mengapa hasilnya demikian." },
    {
      answer: "Konsep ini menjelaskan suatu proses.",
      score: 70,
      probing: {
        status: "accepted",
        evidenceGap: { type: "causal_reasoning" },
        answer: "Menurut saya hasilnya cukup baik.",
      },
    }
  );
  assert.equal(result.impact.evidenceGain, 0);
  assert.equal(result.final.coverage, result.initial.coverage);
});

test("works without probing", () => {
  const result = measureEvidenceQuality(
    { text: "Jelaskan konsep." },
    { answer: "Konsep adalah makna dari suatu gagasan.", score: 75 }
  );
  assert.equal(result.probe, null);
  assert.equal(result.impact.baselineScore, null);
  assert.equal(result.impact.scoreDelta, null);
});
