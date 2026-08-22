const test = require("node:test");
const assert = require("node:assert/strict");

const { calculateFinalScore } = require("../server/evaluation/scoring");
const { createHarness } = require("../server/harness");
const { MockProvider } = require("../server/ai/mock-provider");
const { parse } = require("../server/ai/response-parser");

const RUBRIC = {
  id: "rubric-v1",
  criteria: [
    { id: "concept", name: "Conceptual Understanding", weight: 0.4, scale: 100 },
    { id: "application", name: "Application", weight: 0.3, scale: 100 },
    { id: "communication", name: "Communication", weight: 0.3, scale: 100 },
  ],
};

// ---------------------------------------------------------------------------
// Deterministic scoring engine
// ---------------------------------------------------------------------------

test("calculateFinalScore computes weighted score (PRD example)", () => {
  const criteria = [
    { criterionId: "concept", score: 82 },
    { criterionId: "application", score: 76 },
    { criterionId: "communication", score: 85 },
  ];
  const res = calculateFinalScore(criteria, RUBRIC);
  // 82*0.4 = 32.8 ; 76*0.3=22.8 ; 85*0.3=25.5 => 81.1
  assert.equal(res.finalScore, 81.1);
  assert.equal(res.detail.length, 3);
});

test("calculateFinalScore rejects invalid rubric (sum != 1)", () => {
  const bad = {
    criteria: [
      { id: "a", weight: 0.7 },
      { id: "b", weight: 0.7 },
    ],
  };
  assert.throws(() => calculateFinalScore([{ criterionId: "a", score: 80 }], bad));
});

test("calculateFinalScore rejects unknown criterion", () => {
  const criteria = [{ criterionId: "nope", score: 50 }];
  assert.throws(() => calculateFinalScore(criteria, RUBRIC));
});

// ---------------------------------------------------------------------------
// Model provider + response parser
// ---------------------------------------------------------------------------

test("MockProvider is deterministic and produces no random values", async () => {
  const provider = new MockProvider();
  const prompt = JSON.stringify({ rubric: RUBRIC, answers: ["fotosintesis adalah proses", "aplikasi nyata", "komunikasi lisan"] });
  const a = await provider.generate({ prompt }).then(JSON.parse);
  const b = await new MockProvider().generate({ prompt }).then(JSON.parse);
  assert.deepEqual(a.criteria, b.criteria);
});

// ---------------------------------------------------------------------------
// Harness end-to-end
// ---------------------------------------------------------------------------

test("harness runs full pipeline and emits canonical output", async () => {
  const harness = createHarness();
  harness.setProvider(new MockProvider()).setParser({ parse });

  const result = await harness.evaluate({
    assessmentId: "assess-1",
    assessment: {
      topic: "Fotosintesis",
      rubric: "Akurasi 40%, Kelengkapan 60%",
    },
    rubric: RUBRIC,
    answers: ["Fotosintesis adalah proses tumbuhan membuat makanan dari cahaya"],
    studentName: "A",
    tenantId: "t1",
    userId: "u1",
  });

  assert.ok(result.evaluationId);
  assert.ok(result.evaluationRunId);
  assert.ok(result.finalScore >= 0 && result.finalScore <= 100);
  assert.ok(Array.isArray(result.criteria) && result.criteria.length === 3);
  assert.ok(result.verification.valid === true);
  assert.equal(typeof result.trace, "object");
  // Server-side, not LLM-computed:
  assert.equal(typeof result.weighted.finalScore, "number");
});

test("harness validates before evaluating when no rubric is available", async () => {
  const harness = createHarness();
  harness.setProvider(new MockProvider()).setParser({ parse });
  await assert.rejects(
    () => harness.evaluate({ assessmentId: "x", answers: ["a"] }),
    /Rubric tidak tersedia/
  );
});