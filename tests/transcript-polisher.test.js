const test = require("node:test");
const assert = require("node:assert/strict");
const { preservesSourceOrder, cleanFallback } = require("../server/evaluation/transcript-polisher");

test("provenance gate accepts conservative cleanup", () => {
  assert.equal(
    preservesSourceOrder("eee saya saya memahami konsep caching dengan baik", "saya memahami konsep caching dengan baik"),
    true
  );
});

test("provenance gate rejects invented content", () => {
  assert.equal(
    preservesSourceOrder("saya memahami caching", "saya sangat memahami caching di Redis"),
    false
  );
});

test("provenance gate rejects reordered content", () => {
  assert.equal(
    preservesSourceOrder("caching menggunakan memori untuk menyimpan data", "menyimpan data menggunakan memori caching"),
    false
  );
});

test("fallback only normalizes whitespace", () => {
  assert.equal(cleanFallback("  saya   memahami   caching  "), "saya memahami caching");
});
