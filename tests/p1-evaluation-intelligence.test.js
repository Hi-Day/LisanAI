const assert = require("node:assert/strict");
const test = require("node:test");

// ---------------------------------------------------------------------------
// P1-1/P1-3 — Evaluation Context Cache & Versioning
// ---------------------------------------------------------------------------

const {
  computeContextHash,
  computeContextVersion,
  get,
  set,
  getStats,
  reset,
} = require("../server/harness/context-cache");

const stable = {
  rubric: { id: "r1", criteria: [{ id: "c1", weight: 0.5 }, { id: "c2", weight: 0.5 }] },
  questions: [{ prompt: "Q1" }, { prompt: "Q2" }],
  model: "test/model",
  temperature: 0.25,
  topP: 1,
  maxTokens: 4000,
  promptTemplate: "SYSTEM PROMPT",
  harnessVersion: "1.0.0",
  engineVersion: "1.0.0",
  promptVersion: "v1",
};

test("computeContextHash is deterministic for identical stable context", () => {
  const a = computeContextHash({ tenantId: "t1", ...stable });
  const b = computeContextHash({ tenantId: "t1", ...stable });
  assert.equal(a, b);
  assert.equal(a.length, 64);
});

test("computeContextHash is tenant-scoped (P1-1)", () => {
  const t1 = computeContextHash({ tenantId: "t1", ...stable });
  const t2 = computeContextHash({ tenantId: "t2", ...stable });
  assert.notEqual(t1, t2);
});

test("computeContextHash excludes volatile student answers", () => {
  const withAnswers = computeContextHash({
    tenantId: "t1",
    ...stable,
    answers: ["student secret answer"],
    studentName: "Alice",
  });
  // Answers/name are not part of the stable context contract, so passing extra
  // keys must not change the hash (they are ignored by canonicalContext).
  assert.equal(withAnswers, computeContextHash({ tenantId: "t1", ...stable }));
});

test("computeContextHash changes when a stable field changes (invalidation)", () => {
  const base = computeContextHash({ tenantId: "t1", ...stable });
  const changedRubric = computeContextHash({ tenantId: "t1", ...stable, rubric: { id: "r2" } });
  const changedModel = computeContextHash({ tenantId: "t1", ...stable, temperature: 0.8 });
  assert.notEqual(base, changedRubric);
  assert.notEqual(base, changedModel);
});

test("context cache get/set + hit/miss stats", () => {
  reset();
  const hash = computeContextHash({ tenantId: "t1", ...stable });
  assert.equal(get("t1", hash), null);
  const statsAfterMiss = getStats();
  assert.equal(statsAfterMiss.misses, 1);

  const artifact = { contextHash: hash, systemPrompt: "SYS" };
  set("t1", hash, artifact);
  const hit = get("t1", hash);
  assert.equal(hit.systemPrompt, "SYS");
  const stats = getStats();
  assert.equal(stats.hits, 1);
  assert.equal(stats.misses, 1);
  assert.equal(stats.hitRate, 0.5);
});

test("context cache is tenant-namespaced (same hash, different tenant)", () => {
  reset();
  const hash = computeContextHash({ tenantId: "t1", ...stable });
  set("t1", hash, { v: 1 });
  // A different tenant asking for the same content hash is a different key.
  assert.equal(get("t2", hash), null);
});

test("computeContextVersion is stable and includes the schema version", () => {
  const hash = computeContextHash({ tenantId: "t1", ...stable });
  const v = computeContextVersion(hash);
  assert.match(v, /^ctx-v\d+-[a-f0-9]{8}$/);
});

// ---------------------------------------------------------------------------
// P1-4/P1-5/P1-17 — Risk scoring + policy
// ---------------------------------------------------------------------------

const {
  computeRiskScore,
  classifyRisk,
  applyPolicy,
  difficultyCoefficient,
  scoreRiskCoefficient,
} = require("../server/harness/risk");

const confidentCriteria = [
  { criterionId: "c1", score: 80, confidence: 0.95 },
  { criterionId: "c2", score: 85, confidence: 0.92 },
];
const lowConfidenceCriteria = [
  { criterionId: "c1", score: 40, confidence: 0.2 },
  { criterionId: "c2", score: 95, confidence: 0.15 },
];

test("high confidence + valid evidence => low risk", () => {
  const score = computeRiskScore({
    criteria: confidentCriteria,
    verification: { status: "PASS", issues: [] },
    difficulty: "mudah",
  });
  assert.ok(score <= 0.3, `expected LOW risk, got ${score}`);
  assert.equal(classifyRisk(score), "LOW");
});

test("low confidence + evidence issues => high risk", () => {
  const score = computeRiskScore({
    criteria: lowConfidenceCriteria,
    verification: {
      status: "REVIEW",
      issues: [{ type: "NO_EVIDENCE" }, { type: "UNGROUNDED_EVIDENCE" }],
    },
    difficulty: "sulit",
  });
  assert.ok(score > 0.5, `expected elevated risk, got ${score}`);
});

test("risk score is bounded to [0,1]", () => {
  const s = computeRiskScore({ criteria: [], verification: {}, difficulty: "sulit" });
  assert.ok(s >= 0 && s <= 1);
});

test("classifyRisk thresholds map to LOW/MEDIUM/HIGH", () => {
  assert.equal(classifyRisk(0.1), "LOW");
  assert.equal(classifyRisk(0.5), "MEDIUM");
  assert.equal(classifyRisk(0.9), "HIGH");
  // Configurable thresholds (P1-5).
  assert.equal(classifyRisk(0.5, { low: 0.6, high: 0.8 }), "LOW");
});

test("applyPolicy escalates HIGH clean PASS to human review (REVIEW-only escalation)", () => {
  const policy = applyPolicy("HIGH", { status: "PASS", valid: true }, {
    verification: { low: false, medium: true, high: true },
    retry: { low: 0, medium: 1, high: 1 },
  });
  assert.equal(policy.requiresHumanReview, true);
  assert.equal(policy.decision, "review");
});

test("applyPolicy never downgrades a REVIEW gate to accept", () => {
  const policy = applyPolicy("LOW", { status: "REVIEW", valid: false }, {
    verification: { low: false, medium: true, high: true },
    retry: { low: 0, medium: 1, high: 1 },
  });
  // Even though risk is LOW, an existing REVIEW gate stays review.
  assert.equal(policy.requiresHumanReview, true);
  assert.equal(policy.decision, "review");
});

test("applyPolicy accepts LOW risk with a clean PASS gate", () => {
  const policy = applyPolicy("LOW", { status: "PASS", valid: true }, {
    verification: { low: false, medium: true, high: true },
    retry: { low: 0, medium: 1, high: 1 },
  });
  assert.equal(policy.requiresHumanReview, false);
  assert.equal(policy.decision, "accept");
});

test("difficultyCoefficient maps mudah/sedang/sulit", () => {
  assert.equal(difficultyCoefficient("mudah"), 0);
  assert.equal(difficultyCoefficient("sedang"), 0.5);
  assert.equal(difficultyCoefficient("sulit"), 1);
});

test("scoreRiskCoefficient rises with extreme/disagreement scores", () => {
  const moderate = scoreRiskCoefficient([{ score: 50 }, { score: 50 }, { score: 50 }]);
  const extreme = scoreRiskCoefficient([{ score: 5 }, { score: 95 }]);
  assert.ok(extreme > moderate);
});

// ---------------------------------------------------------------------------
// P1-6/P1-8 — Confidence calibration (ECE, Brier)
// ---------------------------------------------------------------------------

const {
  expectedCalibrationError,
  brierScore,
  calibrationBins,
} = require("../server/evaluation/metrics");

test("ECE is ~0 for a well-calibrated batch (accuracy ≈ confidence per bin)", () => {
  // 20 samples all predicted at 0.5, exactly half correct => bin accuracy 0.5.
  const confidence = Array.from({ length: 20 }, () => 0.5);
  const correctness = Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 1 : 0));
  const ece = expectedCalibrationError(confidence, correctness);
  assert.equal(ece, 0);
});

test("ECE penalizes overconfidence", () => {
  // Model says 0.9 but is only correct 50% of the time => large ECE.
  const confidence = [0.9, 0.9, 0.9, 0.9];
  const correctness = [1, 1, 0, 0];
  const ece = expectedCalibrationError(confidence, correctness);
  assert.ok(ece > 0.2, `expected large ECE, got ${ece}`);
});

test("Brier score is 0 for perfect and 1 for always-wrong-and-certain", () => {
  assert.equal(brierScore([1, 1, 0, 0], [1, 1, 0, 0]), 0);
  assert.equal(brierScore([1, 1], [0, 0]), 1);
});

test("calibrationBins partitions into bins with counts", () => {
  const { bins, n } = calibrationBins([0.05, 0.15, 0.95], [0, 1, 1], 10);
  assert.equal(n, 3);
  assert.ok(bins.every((b) => typeof b.low === "number"));
});

// ---------------------------------------------------------------------------
// P1-10/P1-11 — Repeatability & score stability
// ---------------------------------------------------------------------------

const { isScoreStable, scoreStability } = require("../server/evaluation/metrics");

test("isScoreStable within threshold", () => {
  assert.equal(isScoreStable(82, 84, 10), true);
  assert.equal(isScoreStable(82, 61, 10), false);
  assert.equal(isScoreStable(82, 61, 25), true);
});

test("scoreStability flags unstable repeated evaluations (P1-11)", () => {
  const stable = scoreStability([82, 84, 83]);
  assert.equal(stable.stableRatio, 1);
  const unstable = scoreStability([82, 61, 50]);
  assert.equal(unstable.stableRatio, 0);
  assert.ok(unstable.meanAbsDiff > 10);
});

test("scoreStability supports runs x submissions matrix", () => {
  const res = scoreStability([[80, 90], [82, 88], [81, 20]], 10);
  assert.equal(res.n, 2);
  assert.ok(res.stableRatio >= 0 && res.stableRatio <= 1);
});

// ---------------------------------------------------------------------------
// P1 integration — harness emits context versioning + risk + cache hit/miss
// ---------------------------------------------------------------------------

test("harness emits context versioning + risk, and caches stable context", async () => {
  const os = require("node:os");
  const path = require("node:path");
  process.env.TURSO_DATABASE_URL = `file:${path.join(os.tmpdir(), `p1-harness-${Date.now()}.db`)}`;
  process.env.ENABLE_DEMO_SIMULATION = "false";
  process.env.HARNESS_PROVIDER = "mock";
  const { initDatabase } = require("../server/database");
  const { evaluateWithHarness } = require("../server/harness/harness-evaluator");
  const contextCache = require("../server/harness/context-cache");
  contextCache.reset();
  await initDatabase();

  const payload = {
    tenantId: "t1", userId: "u1",
    assessment: {
      id: "a1",
      questions: [{ prompt: "Jelaskan fotosintesis?", criteria: [{ id: "c1", name: "Ketepatan" }] }],
      rubric: { criteria: [{ id: "c1", name: "Ketepatan", weight: 100 }] },
      difficulty: "mudah",
    },
    answers: ["Fotosintesis mengubah cahaya menjadi energi kimia."],
    studentName: "Alice",
  };
  const r1 = await evaluateWithHarness(payload);
  assert.ok(r1.versioning && r1.versioning.contextHash, "contextHash present");
  assert.match(r1.versioning.contextVersion, /^ctx-v\d+-[a-f0-9]{8}$/);
  assert.ok(r1.risk && r1.risk.level, "risk present");
  assert.ok(["LOW", "MEDIUM", "HIGH"].includes(r1.risk.level));

  // Second student, identical stable context => same hash, cache HIT.
  const r2 = await evaluateWithHarness({ ...payload, studentName: "Bob" });
  assert.equal(r1.versioning.contextHash, r2.versioning.contextHash, "stable context identical across students");
  const stats = contextCache.getStats();
  assert.equal(stats.hits, 1, "expected one cache hit");
  assert.equal(stats.misses, 1, "expected one cache miss");
});