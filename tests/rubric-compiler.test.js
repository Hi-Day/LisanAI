const test = require("node:test");
const assert = require("node:assert/strict");

const {
  compileRubric,
  rubricHash,
} = require("../server/harness/rubric-compiler");

const STRUCTURED = {
  criteria: [
    { id: "accuracy", name: "Akurasi Konsep", description: "Ketepatan konsep", weight: 40 },
    { id: "completeness", name: "Kelengkapan", description: "Kelengkapan jawaban", weight: 60 },
  ],
};

const FREETEXT = "Akurasi Konsep 40%, Kelengkapan 60%";

// ---------------------------------------------------------------------------
// Valid rubric
// ---------------------------------------------------------------------------

test("compiler: structured rubric normalized to weights summing to 1", () => {
  const compiled = compileRubric({ rubric: STRUCTURED });
  assert.equal(compiled.version, "v1");
  assert.equal(compiled.criteria.length, 2);
  const sum = compiled.criteria.reduce((a, c) => a + c.weight, 0);
  assert.ok(Math.abs(sum - 1) < 1e-6, `sum=${sum}`);
  assert.equal(compiled.criteria[0].id, "accuracy");
  assert.equal(compiled.criteria[0].description, "Ketepatan konsep");
});

test("compiler: deterministic hash for identical rubric", () => {
  const a = compileRubric({ rubric: STRUCTURED });
  const b = compileRubric({ rubric: STRUCTURED });
  assert.equal(a.hash, b.hash);
  assert.equal(rubricHash(STRUCTURED), a.hash);
});

test("compiler: same rubric, different key order -> same hash", () => {
  const one = compileRubric({ rubric: STRUCTURED });
  const shuffled = compileRubric({
    rubric: {
      criteria: [
        { id: "completeness", name: "Kelengkapan", description: "Kelengkapan jawaban", weight: 60 },
        { id: "accuracy", name: "Akurasi Konsep", description: "Ketepatan konsep", weight: 40 },
      ],
    },
  });
  assert.equal(one.hash, shuffled.hash);
});

test("compiler: output is immutable (frozen)", () => {
  const compiled = compileRubric({ rubric: STRUCTURED });
  assert.ok(Object.isFrozen(compiled));
  assert.ok(Object.isFrozen(compiled.criteria));
  assert.ok(Object.isFrozen(compiled.criteria[0]));
  // Mutation attempt is a no-op on a frozen object.
  const mutate = () => { "use strict"; compiled.criteria[0].weight = 0.9; };
  assert.throws(mutate, TypeError);
});

// ---------------------------------------------------------------------------
// Free-text and fallback
// ---------------------------------------------------------------------------

test("compiler: free-text rubric parsed and normalized", () => {
  const compiled = compileRubric({ rubric: FREETEXT });
  assert.equal(compiled.criteria.length, 2);
  const sum = compiled.criteria.reduce((a, c) => a + c.weight, 0);
  assert.ok(Math.abs(sum - 1) < 1e-6);
  assert.ok(compiled.criteria.every((c) => /^[a-z0-9_]+$/.test(c.id)));
});

test("compiler: fallback rubric when none provided -> single uniform criterion", () => {
  const compiled = compileRubric({});
  assert.equal(compiled.criteria.length, 1);
  assert.equal(compiled.criteria[0].weight, 1);
});

test("compiler: null rubric -> fallback", () => {
  const compiled = compileRubric({ rubric: null });
  assert.equal(compiled.criteria.length, 1);
});

// ---------------------------------------------------------------------------
// Invalid rubric
// ---------------------------------------------------------------------------

test("compiler: duplicate criterion id rejected", () => {
  assert.throws(
    () =>
      compileRubric({
        rubric: {
          criteria: [
            { id: "acc", name: "A", weight: 0.5 },
            { id: "acc", name: "B", weight: 0.5 },
          ],
        },
      }),
    /duplikat/
  );
});

test("compiler: negative weight rejected", () => {
  assert.throws(
    () => compileRubric({ rubric: { criteria: [{ id: "a", name: "A", weight: -0.5 }] } }),
    /negatif/
  );
});

test("compiler: all-zero weight rejected", () => {
  assert.throws(
    () => compileRubric({ rubric: { criteria: [{ id: "a", name: "A", weight: 0 }] } }),
    /total weight > 0/
  );
});

test("compiler: non-finite weight rejected", () => {
  assert.throws(
    () => compileRubric({ rubric: { criteria: [{ id: "a", name: "A", weight: Number.NaN }] } }),
    /tidak valid/
  );
});

test("compiler: missing name rejected", () => {
  assert.throws(
    () => compileRubric({ rubric: { criteria: [{ id: "a", weight: 1 }] } }),
    /wajib memiliki nama/
  );
});

// ---------------------------------------------------------------------------
// Weight normalization behavior
// ---------------------------------------------------------------------------

test("compiler: weights are renormalized when they do not sum to 1", () => {
  const compiled = compileRubric({
    rubric: { criteria: [{ id: "a", name: "A", weight: 2 }, { id: "b", name: "B", weight: 2 }] },
  });
  const sum = compiled.criteria.reduce((a, c) => a + c.weight, 0);
  assert.ok(Math.abs(sum - 1) < 1e-6);
  assert.equal(compiled.criteria[0].weight, 0.5);
});

test("compiler: zero-weight criterion allowed alongside weighted ones", () => {
  const compiled = compileRubric({
    rubric: {
      criteria: [
        { id: "a", name: "A", weight: 1 },
        { id: "b", name: "B", weight: 0 },
      ],
    },
  });
  assert.equal(compiled.criteria.find((c) => c.id === "b").weight, 0);
});

// ---------------------------------------------------------------------------
// Deterministic id generation
// ---------------------------------------------------------------------------

test("compiler: deterministic ids derived from names when id absent", () => {
  const a = compileRubric({ rubric: { criteria: [{ name: "Akurasi Konsep", weight: 1 }] } });
  const b = compileRubric({ rubric: { criteria: [{ name: "Akurasi Konsep", weight: 1 }] } });
  assert.equal(a.criteria[0].id, b.criteria[0].id);
  assert.equal(a.hash, b.hash);
});

test("compiler: collision-safe slugs for same-named criteria", () => {
  const compiled = compileRubric({
    rubric: { criteria: [{ name: "Konsep", weight: 0.5 }, { name: "Konsep", weight: 0.5 }] },
  });
  const ids = compiled.criteria.map((c) => c.id);
  assert.equal(new Set(ids).size, 2, "ids must be distinct");
});
