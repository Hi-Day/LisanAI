const test = require("node:test");
const assert = require("node:assert/strict");

const { mapWithConcurrency } = require("../server/harness/concurrency");

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Bounded concurrency
// ---------------------------------------------------------------------------

test("concurrency: never exceeds the configured limit of active tasks", async () => {
  let active = 0;
  let peak = 0;
  const results = await mapWithConcurrency(
    [0, 1, 2, 3, 4, 5],
    3,
    async () => {
      active += 1;
      peak = Math.max(peak, active);
      await delay(5);
      active -= 1;
      return active;
    }
  );
  assert.equal(peak, 3, `peak active should be 3, got ${peak}`);
  assert.equal(results.length, 6);
});

test("concurrency: all results mapped back to correct index in order", async () => {
  const results = await mapWithConcurrency(
    ["a", "b", "c", "d"],
    2,
    (item) => Promise.resolve(`${item}->${item}`)
  );
  assert.deepEqual(
    results.map((r) => r.value),
    ["a->a", "b->b", "c->c", "d->d"]
  );
  assert.deepEqual(
    results.map((r) => r.index),
    [0, 1, 2, 3]
  );
});

test("concurrency: concurrency 1 runs strictly sequentially", async () => {
  const order = [];
  await mapWithConcurrency(
    [0, 1, 2],
    1,
    async (item) => { order.push(`start${item}`); await delay(1); order.push(`end${item}`); }
  );
  assert.deepEqual(order, ["start0", "end0", "start1", "end1", "start2", "end2"]);
});

test("concurrency: independent results map to correct question despite order", async () => {
  // Completion order is intentionally different from item order.
  const results = await mapWithConcurrency(
    ["slow", "fast", "mid"],
    3,
    async (item) => {
      const ms = item === "slow" ? 30 : item === "mid" ? 10 : 1;
      await delay(ms);
      return item.toUpperCase();
    }
  );
  assert.deepEqual(results.map((r) => r.value), ["SLOW", "FAST", "MID"]);
  assert.deepEqual(results.map((r) => r.index), [0, 1, 2]);
});

// ---------------------------------------------------------------------------
// Failure isolation
// ---------------------------------------------------------------------------

test("concurrency: a task failure does not reject the whole batch", async () => {
  const results = await mapWithConcurrency(
    [0, 1, 2, 3],
    2,
    async (item) => {
      if (item === 1) throw new Error("boom on 1");
      return item * 10;
    }
  );
  assert.equal(results.length, 4);
  assert.equal(results[0].value, 0);
  assert.ok(results[1].error, "item 1 should carry an error");
  assert.equal(results[2].value, 20);
  assert.equal(results[3].value, 30);
});

test("concurrency: non-error throw is normalized into an Error", async () => {
  const results = await mapWithConcurrency([0, 1], 1, async (i) => {
    if (i === 1) throw "string rejection";
    return "ok";
  });
  assert.equal(results[1].value, undefined);
  assert.ok(results[1].error instanceof Error);
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test("concurrency: empty list resolves to empty results", async () => {
  const results = await mapWithConcurrency([], 3, async () => "x");
  assert.deepEqual(results, []);
});

test("concurrency: more items than concurrency still processes all", async () => {
  const results = await mapWithConcurrency(
    [0, 1, 2, 3, 4],
    2,
    async (i) => i
  );
  assert.equal(results.length, 5);
  assert.deepEqual(results.map((r) => r.value), [0, 1, 2, 3, 4]);
});