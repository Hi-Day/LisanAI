const assert = require("node:assert/strict");
const test = require("node:test");
const { validateBenchmarkRequest } = require("../api/benchmark-experiment");

test("benchmark request accepts a bounded valid config", () => {
  assert.deepEqual(validateBenchmarkRequest({
    dataset: "sample-bench-smoke",
    mode: "both",
    provider: "mock",
    sampleLimit: 10,
    repeats: 2,
  }), {
    valid: true,
    dataset: "sample-bench-smoke",
    mode: "both",
    provider: "mock",
    sampleLimit: 10,
    repeats: 2,
  });
});

test("benchmark request rejects arbitrary dataset paths", () => {
  assert.equal(validateBenchmarkRequest({ dataset: "../secrets" }).valid, false);
});

test("benchmark request rejects unsupported modes, providers, and excessive runs", () => {
  assert.match(validateBenchmarkRequest({ dataset: "safe", mode: "production" }).error, /Mode/);
  assert.match(validateBenchmarkRequest({ dataset: "safe", provider: "local-shell" }).error, /Provider/);
  assert.match(validateBenchmarkRequest({ dataset: "safe", sampleLimit: 21 }).error, /sampel/);
  assert.match(validateBenchmarkRequest({ dataset: "safe", repeats: 4 }).error, /Repeated runs/);
  assert.match(validateBenchmarkRequest({ dataset: "safe", mode: "both", sampleLimit: 20, repeats: 1 }).error, /30 evaluasi model/);
});
