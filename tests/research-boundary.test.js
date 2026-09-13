const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const applicationPath = path.join(root, "server", "application", "research-controller.js");
const apiPath = path.join(root, "api-internal", "research.js");

test("research API no longer uses the legacy api-internal boundary", () => {
  assert.equal(fs.existsSync(apiPath), false);
});

test("research application controller does not access the database directly", () => {
  const source = fs.readFileSync(applicationPath, "utf8");
  assert.doesNotMatch(source, /require\(["']\.\.\/database["']\)/);
  assert.doesNotMatch(source, /getDb\s*\(/);
  assert.doesNotMatch(source, /SELECT\s+/i);
});

test("research application controller delegates run reads to repository", () => {
  const source = fs.readFileSync(applicationPath, "utf8");
  assert.match(source, /listEvaluationRuns/);
  assert.match(source, /getEvaluationTrace/);
});
