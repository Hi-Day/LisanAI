const assert = require("node:assert/strict");
const test = require("node:test");
const { DEFAULT_COUNT, recommendLearningOutcomes } = require("../server/outcome-recommendation");

test("learning outcome recommendation is exactly three by default", async () => {
  assert.equal(DEFAULT_COUNT, 3);
  const outcomes = await recommendLearningOutcomes({ topic: "Sistem pernapasan", mock: true });
  assert.equal(outcomes.length, 3);
  assert.equal(new Set(outcomes).size, 3);
});

test("learning outcome recommendation can generate one additional outcome", async () => {
  const existing = ["Siswa mampu menjelaskan konsep utama sistem pernapasan."];
  const outcomes = await recommendLearningOutcomes({
    topic: "Sistem pernapasan",
    existingOutcomes: existing,
    count: 1,
    mock: true,
  });
  assert.equal(outcomes.length, 3);
  assert.ok(outcomes.every((outcome) => typeof outcome === "string" && outcome.length > 0));
});
