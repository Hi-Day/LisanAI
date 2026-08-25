const test = require("node:test");
const assert = require("node:assert/strict");

const {
  computeFinalScore,
  calculateFinalScore,
  round,
} = require("../server/evaluation/scoring");

const RUBRIC = {
  id: "rubric-full",
  criteria: [
    { id: "concept", name: "Conceptual Understanding", weight: 0.4 },
    { id: "application", name: "Application", weight: 0.3 },
    { id: "communication", name: "Communication", weight: 0.3 },
  ],
};

// ---------------------------------------------------------------------------
// Normal weighted scoring
// ---------------------------------------------------------------------------

test("computeFinalScore: normal full-rubric weighted scoring", () => {
  const res = computeFinalScore({
    criteria: [
      { criterionId: "concept", score: 82 },
      { criterionId: "application", score: 76 },
      { criterionId: "communication", score: 85 },
    ],
    rubric: RUBRIC,
  });
  // 82*0.4 + 76*0.3 + 85*0.3 = 32.8 + 22.8 + 25.5 = 81.1
  assert.equal(res.finalScore, 81.1);
  assert.equal(res.method, "weighted-mean-raw");
  assert.ok(res.hasCompleteCriteria);
  assert.deepEqual(res.missingCriterionIds, []);
  assert.equal(res.detail.length, 3);
  // Effective weights unchanged when the subset already sums to 1.
  assert.equal(res.detail[0].weight, 0.4);
});

// ---------------------------------------------------------------------------
// Weight renormalization (per-question / aligned subset)
// ---------------------------------------------------------------------------

test("computeFinalScore: renormalizes weights over a partial subset", () => {
  const res = computeFinalScore({
    criteria: [
      { criterionId: "concept", score: 80 },
      { criterionId: "application", score: 60 },
    ],
    rubric: RUBRIC, // subset { .4, .3 } sums to 0.7
  });
  // scale = 1/0.7 ; concept 80*(0.4/0.7)=80*0.5714=45.714 ; app 60*(0.3/0.7)=25.714
  assert.equal(res.method, "weighted-mean");
  // 80*0.5714286 + 60*0.4285714 = 45.7143 + 25.7143 = 71.4286 ~ 71.43
  assert.equal(res.finalScore, 71.43);
  assert.ok(!res.hasCompleteCriteria);
  assert.deepEqual(res.missingCriterionIds, ["communication"]);
});

test("computeFinalScore: excluded criteria are not scored nor reported missing", () => {
  const res = computeFinalScore({
    criteria: [
      { criterionId: "concept", score: 80 },
      { criterionId: "application", score: 60 },
    ],
    rubric: RUBRIC,
    options: { excludedCriterionIds: ["communication"] },
  });
  assert.deepEqual(res.missingCriterionIds, []);
  assert.ok(res.hasCompleteCriteria, "excluded criteria are intentional, not missing");
  assert.ok(res.excludedCriterionIds.includes("communication"));
});

// ---------------------------------------------------------------------------
// Missing criteria
// ---------------------------------------------------------------------------

test("computeFinalScore: reports missing criteria instead of inventing them", () => {
  const res = computeFinalScore({
    criteria: [{ criterionId: "concept", score: 90 }],
    rubric: RUBRIC,
  });
  assert.equal(res.hasCompleteCriteria, false);
  assert.deepEqual(
    res.missingCriterionIds.sort(),
    ["application", "communication"].sort()
  );
  // Score reflects only what was actually present (renormalized).
  assert.equal(res.finalScore, 90);
});

// ---------------------------------------------------------------------------
// Zero-weight criteria
// ---------------------------------------------------------------------------

test("computeFinalScore: zero-weight criteria contribute nothing", () => {
  const rubric = {
    criteria: [
      { id: "a", weight: 0.5 },
      { id: "b", weight: 0.5 },
      { id: "c", weight: 0 }, // zero weight
    ],
  };
  const res = computeFinalScore({
    criteria: [
      { criterionId: "a", score: 80 },
      { criterionId: "b", score: 60 },
      { criterionId: "c", score: 100 },
    ],
    rubric,
  });
  // effective subset = {a:0.5, b:0.5} -> a 40, b 30 = 70
  assert.equal(res.finalScore, 70);
  const c = res.detail.find((d) => d.criterionId === "c");
  assert.ok(!c || c.contribution === 0);
});

test("computeFinalScore: all-zero weights returns 0 score and 'none' method", () => {
  const rubric = { criteria: [{ id: "a", weight: 0 }, { id: "b", weight: 0 }] };
  const res = computeFinalScore({
    criteria: [
      { criterionId: "a", score: 80 },
      { criterionId: "b", score: 90 },
    ],
    rubric,
  });
  assert.equal(res.finalScore, 0);
  assert.equal(res.method, "none");
  assert.equal(res.hasCompleteCriteria, false);
});

// ---------------------------------------------------------------------------
// Empty criteria / rubric
// ---------------------------------------------------------------------------

test("computeFinalScore: empty criteria returns 0 with completeness=false", () => {
  const res = computeFinalScore({ rubric: RUBRIC, criteria: [] });
  assert.equal(res.finalScore, 0);
  assert.equal(res.hasCompleteCriteria, false);
  assert.deepEqual(res.missingCriterionIds.sort(), ["application", "communication", "concept"].sort());
});

test("computeFinalScore: empty rubric throws", () => {
  assert.throws(() => computeFinalScore({ rubric: { criteria: [] }, criteria: [] }), /Rubric tidak valid/);
  assert.throws(() => computeFinalScore({ rubric: null, criteria: [] }), /Rubric tidak valid/);
});

test("computeFinalScore: criteria must be an array", () => {
  assert.throws(() => computeFinalScore({ rubric: RUBRIC, criteria: null }), /criteria harus berupa array/);
});

// ---------------------------------------------------------------------------
// Invalid scores / weights
// ---------------------------------------------------------------------------

test("computeFinalScore: non-numeric score throws", () => {
  assert.throws(
    () => computeFinalScore({ rubric: { criteria: [{ id: "a", weight: 1 }] }, criteria: [{ criterionId: "a", score: "abc" }] }),
    /Skor criterion tidak valid/
  );
  assert.throws(
    () => computeFinalScore({ rubric: { criteria: [{ id: "a", weight: 1 }] }, criteria: [{ criterionId: "a", score: null }] }),
    /Skor criterion tidak valid/
  );
});

test("computeFinalScore: out-of-range numeric score is clamped (preserve semantics)", () => {
  const rubric = { criteria: [{ id: "a", weight: 1 }] };
  assert.equal(computeFinalScore({ rubric, criteria: [{ criterionId: "a", score: 150 }] }).finalScore, 100);
  assert.equal(computeFinalScore({ rubric, criteria: [{ criterionId: "a", score: -20 }] }).finalScore, 0);
});

test("computeFinalScore: negative or NaN weight throws", () => {
  const negative = { criteria: [{ id: "a", weight: -0.2 }] };
  assert.throws(
    () => computeFinalScore({ rubric: negative, criteria: [{ criterionId: "a", score: 80 }] }),
    /weight yang tidak valid/
  );
  const nan = { criteria: [{ id: "a", weight: Number.NaN }] };
  assert.throws(
    () => computeFinalScore({ rubric: nan, criteria: [{ criterionId: "a", score: 80 }] }),
    /weight yang tidak valid/
  );
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

test("computeFinalScore: deterministic across repeated calls", () => {
  const a = computeFinalScore({ criteria: RUBRIC.criteria.map((c, i) => ({ criterionId: c.id, score: [82, 76, 85][i] })), rubric: RUBRIC });
  const resultA = computeFinalScore({ criteria: RUBRIC.criteria.map((c, i) => ({ criterionId: c.id, score: [82, 76, 85][i] })), rubric: RUBRIC });
  assert.equal(resultA.finalScore, a.finalScore);
  assert.equal(resultA.finalScore, 81.1);
});

test("computeFinalScore: deterministic across same subset", () => {
  const args = () => ({ criteria: [{ criterionId: "concept", score: 80 }], rubric: RUBRIC });
  assert.equal(computeFinalScore(args()).finalScore, computeFinalScore(args()).finalScore);
});

// ---------------------------------------------------------------------------
// Floating point / rounding
// ---------------------------------------------------------------------------

test("round: half-up rounding with 2 decimals", () => {
  assert.equal(round(71.42857143, 2), 71.43);
  assert.equal(round(2.5, 0), 3);
  assert.equal(round(0.1 + 0.2, 2), 0.3);
});

test("finalScore is clamped to [0,100]", () => {
  const rubric = { criteria: [{ id: "a", weight: 2 }, { id: "b", weight: 2 }] }; // raw sum 4, effective renormalized to 1
  const res = computeFinalScore({
    rubric,
    criteria: [
      { criterionId: "a", score: 100 },
      { criterionId: "b", score: 100 },
    ],
  });
  assert.equal(res.finalScore, 100);
});

// ---------------------------------------------------------------------------
// Complete vs incomplete criteria
// ---------------------------------------------------------------------------

test("hasCompleteCriteria true only when all rubric criteria are provided", () => {
  const complete = computeFinalScore({
    criteria: RUBRIC.criteria.map((c) => ({ criterionId: c.id, score: 80 })),
    rubric: RUBRIC,
  });
  assert.equal(complete.hasCompleteCriteria, true);

  const partial = computeFinalScore({
    criteria: [{ criterionId: "concept", score: 80 }],
    rubric: RUBRIC,
  });
  assert.equal(partial.hasCompleteCriteria, false);
  assert.deepEqual(partial.missingCriterionIds.sort(), ["application", "communication"].sort());
});

// ---------------------------------------------------------------------------
// Backward compatibility of calculateFinalScore
// ---------------------------------------------------------------------------

test("calculateFinalScore still returns weighted + formula (back-compat)", () => {
  const res = calculateFinalScore(
    [
      { criterionId: "concept", score: 82 },
      { criterionId: "application", score: 76 },
      { criterionId: "communication", score: 85 },
    ],
    RUBRIC
  );
  assert.equal(res.finalScore, 81.1);
  assert.equal(res.detail.length, 3);
  assert.ok(res.formula.includes("82"));
});