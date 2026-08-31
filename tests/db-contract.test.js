const assert = require("node:assert/strict");
const test = require("node:test");
const { assertDatabaseContract } = require("../server/db/contract");

test("database contract accepts the supported adapter surface", () => {
  const db = { all() {}, get() {}, run() {}, exec() {} };
  assert.equal(assertDatabaseContract(db), db);
});

test("database contract rejects provider-specific/incomplete adapters", () => {
  assert.throws(() => assertDatabaseContract({ all() {}, get() {}, run() {} }), /exec/);
});
