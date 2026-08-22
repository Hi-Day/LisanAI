const assert = require("node:assert/strict");
const test = require("node:test");

const { reliabilityVector } = require("../server/harness/scoring/reliability");
const { createHarness } = require("../server/harness");
const { MockProvider } = require("../server/ai/mock-provider");
const { parse } = require("../server/ai/response-parser");

// ---------------------------------------------------------------------------
// PR-06 / FR-10 — Reliability Vector
// ---------------------------------------------------------------------------

test("reliabilityVector has the five FR-10 dimensions and overallReliability", () => {
  const v = reliabilityVector({
    criteria: [
      { criterionId: "C1", score: 82, evidence: [{ text: "a", grounded: true }], confidence: 0.9 },
      { criterionId: "C2", score: 75, evidence: [{ text: "b", grounded: true }], confidence: 0.8 },
    ],
    rubricCriteria: [
      { id: "C1" },
      { id: "C2" },
    ],
    verification: { valid: true, status: "PASS", scoreConsistency: { coverage: 1 } },
    valid: true,
  });
  assert.ok(v.dimensions);
  assert.ok("evidenceGrounding" in v.dimensions);
  assert.ok("criterionCoverage" in v.dimensions);
  assert.ok("rubricAlignment" in v.dimensions);
  assert.ok("scoreConsistency" in v.dimensions);
  assert.ok("outputValidity" in v.dimensions);
  assert.ok(v.overallReliability >= 0 && v.overallReliability <= 1);
});

test("reliabilityVector: perfect conditions -> overallReliability near 1", () => {
  const v = reliabilityVector({
    criteria: [
      { criterionId: "C1", score: 90, evidence: [{ text: "a", grounded: true }], confidence: 1 },
    ],
    rubricCriteria: [{ id: "C1" }],
    verification: { valid: true, status: "PASS", scoreConsistency: { coverage: 1 } },
    valid: true,
  });
  assert.equal(v.dimensions.evidenceGrounding, 1);
  assert.equal(v.dimensions.criterionCoverage, 1);
  assert.equal(v.dimensions.outputValidity, 1);
  assert.ok(v.overallReliability > 0.9);
});

test("reliabilityVector: outputValidity=0 when verification invalid", () => {
  const v = reliabilityVector({
    criteria: [{ criterionId: "C1", score: 80, evidence: [] }],
    rubricCriteria: [{ id: "C1" }],
    verification: { valid: false, status: "FAIL" },
    valid: false,
  });
  assert.equal(v.dimensions.outputValidity, 0);
  assert.equal(v.dimensions.evidenceGrounding, 0);
  assert.ok(v.overallReliability < 0.5);
});

test("reliabilityVector: low evidence grounding lowers only that dimension", () => {
  const v = reliabilityVector({
    criteria: [
      { criterionId: "C1", score: 80, evidence: [{ text: "x", grounded: true }], confidence: 0.9 },
      { criterionId: "C2", score: 95, evidence: [], noEvidence: true, confidence: 0.9 },
    ],
    rubricCriteria: [{ id: "C1" }, { id: "C2" }],
    verification: { valid: true, status: "REVIEW", scoreConsistency: { coverage: 0.5 } },
    valid: true,
  });
  assert.equal(v.dimensions.evidenceGrounding, 0.5);
  assert.ok(v.overallReliability < 0.9);
});

// ---------------------------------------------------------------------------
// Wiring into the full harness
// ---------------------------------------------------------------------------

test("harness output carries a reliability vector", async () => {
  const harness = createHarness();
  harness.setProvider(new MockProvider()).setParser({ parse });
  const result = await harness.evaluate({
    assessmentId: "assess-rel",
    assessment: { topic: "t", rubric: "Konsep 60%, Kelengkapan 40%" },
    rubric: {
      id: "r2",
      criteria: [
        { id: "concept", name: "Konsep", weight: 0.6, scale: 100 },
        { id: "cover", name: "Kelengkapan", weight: 0.4, scale: 100 },
      ],
    },
    answers: [
      "jawaban konsep fotosintesis dan klorofil",
      "jawaban kelengkapan tentang tumbuhan hijau",
    ],
    tenantId: "t1",
    userId: "u1",
  });
  assert.ok(result.reliability, "reliability must be present");
  assert.ok(result.reliability.dimensions);
  assert.ok(result.reliability.overallReliability >= 0 && result.reliability.overallReliability <= 1);
  assert.ok(result.verification.status === "PASS" || result.verification.status === "REVIEW");
  assert.ok(result.verification.scoreConsistency, "scoreConsistency must exist");
});

test("reliability can be disabled via HARNESS_RELIABILITY=false", async () => {
  const harness = createHarness({ pipeline: { reliability: false } });
  harness.setProvider(new MockProvider()).setParser({ parse });
  const result = await harness.evaluate({
    assessmentId: "assess-rel-off",
    assessment: { topic: "t", rubric: "Konsep 100%" },
    rubric: { id: "r", criteria: [{ id: "q1", name: "Konsep", weight: 1, scale: 100 }] },
    answers: ["sebuah jawaban"],
    tenantId: "t1",
    userId: "u1",
  });
  assert.equal(result.reliability, null);
});