const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.HARNESS_PROVIDER = "mock";
process.env.TURSO_DATABASE_URL = `file:${path.join(os.tmpdir(), `lisan-bench-${Date.now()}.db`)}`;

const { loadDataset, validateDataset, validateSample } = require("../server/evaluation/benchmark/dataset");
const {
  runSampleHarness,
  runSampleBaseline,
  runExperiment,
  resolveProvider,
  BaselineMockProvider,
} = require("../server/evaluation/benchmark/benchmark");
const { createHarness } = require("../server/harness");
const { MockProvider } = require("../server/ai/mock-provider");
const { parse } = require("../server/ai/response-parser");

// A tiny inline dataset for unit tests (avoids disk coupling).
function makeSample(overrides = {}) {
  return {
    sampleId: "U1",
    question: "Jelaskan konsep X.",
    rubric: {
      id: "r",
      criteria: [
        { id: "concept", name: "Konsep", weight: 0.6, scale: 100 },
        { id: "app", name: "Aplikasi", weight: 0.4, scale: 100 },
      ],
    },
    studentAnswers: ["Konsep X dijelaskan dengan benar dan diterapkan pada contoh nyata fotosintesis."],
    humanScore: 80,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// PR-07 — Dataset schema + loader
// ---------------------------------------------------------------------------

test("loadDataset loads the bundled smoke dataset", () => {
  const ds = loadDataset("sample-bench-smoke");
  assert.equal(ds.version, "v1");
  assert.ok(Array.isArray(ds.samples) && ds.samples.length >= 2);
  assert.ok(ds.samples.every((s) => s.sampleId && s.question && s.humanScore));
});

test("validateDataset flags missing studentAnswers", () => {
  const bad = [makeSample({ studentAnswers: [], question: null })];
  const r = validateDataset(bad);
  assert.equal(r.valid, false);
  assert.equal(r.invalidCount, 1);
});

test("validateSample accepts a well-formed sample", () => {
  const r = validateSample(makeSample(), 0);
  assert.equal(r.valid, true);
});

test("validateSample rejects humanScore out of range", () => {
  const r = validateSample(makeSample({ humanScore: 120 }), 0);
  assert.equal(r.valid, false);
});

// ---------------------------------------------------------------------------
// PR-08 — Baseline runner
// ---------------------------------------------------------------------------

test("runSampleBaseline returns a bounded numeric score (mode=baseline)", async () => {
  const result = await runSampleBaseline(
    new BaselineMockProvider(),
    { parse },
    makeSample()
  );
  assert.equal(result.evaluationMode, "baseline");
  assert.ok(Number.isFinite(result.score));
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.equal(result.humanScore, 80);
});

// ---------------------------------------------------------------------------
// PR-09 — Harness runner
// ---------------------------------------------------------------------------

test("runSampleHarness returns harness provenance (score/verification/reliability)", async () => {
  const harness = createHarness();
  harness.setProvider(new MockProvider()).setParser({ parse });
  const result = await runSampleHarness(harness, makeSample(), { assessmentId: "bench-U1" });
  assert.equal(result.evaluationMode, "harness");
  assert.ok(Number.isFinite(result.score) && result.score >= 0 && result.score <= 100);
  assert.ok(result.verification);
  assert.ok(result.reliability);
  assert.equal(result.sampleId, "U1");
});

// ---------------------------------------------------------------------------
// Full experiment — same dataset input, both architectures
// ---------------------------------------------------------------------------

test("runExperiment runs both modes over the smoke dataset and pairs them", async () => {
  const exp = await runExperiment({ dataset: "sample-bench-smoke", mode: ["baseline", "harness"] });
  assert.equal(exp.datasetVersion, "v1");
  assert.equal(exp.validation.valid, true);
  assert.deepEqual([...new Set(exp.mode)].sort(), ["baseline", "harness"]);
  // 2 samples x 2 modes = 4 results; pairs = 2.
  assert.equal(exp.results.length, 4);
  assert.ok(exp.pairs, "pairs must be present when both modes ran");
  assert.equal(exp.pairs.length, 2);
  for (const p of exp.pairs) {
    assert.ok(typeof p.baselineScore === "number");
    assert.ok(typeof p.harnessScore === "number");
    assert.equal(typeof p.humanScore, "number");
  }
});

test("resolveProvider defaults to mock when openrouter not requested", () => {
  assert.ok(resolveProvider("mock") instanceof MockProvider);
});

test("runExperiment with repeats>1 produces consistency metrics", async () => {
  const exp = await runExperiment({ dataset: "sample-bench-smoke", mode: "harness", repeats: 3 });
  assert.equal(exp.repeats, 3);
  assert.ok(exp.consistency, "consistency present when repeats>1");
  // 2 samples x 3 repeats = 6 harness results.
  const harness = exp.results.filter((r) => r.evaluationMode === "harness");
  assert.equal(harness.length, 6);
  assert.ok(exp.consistency.harness);
  assert.ok(Number.isFinite(exp.consistency.harness.meanVar));
});

test("runExperiment with repeats=1 has no consistency block", async () => {
  const exp = await runExperiment({ dataset: "sample-bench-smoke", mode: "baseline" });
  assert.equal(exp.consistency, null);
});