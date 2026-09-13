const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const controllerPath = path.join(root, "server", "application", "assessment-controller.js");
const servicePath = path.join(root, "server", "application", "assessment-service.js");

test("assessment controller delegates actions to application service", () => {
  const source = fs.readFileSync(controllerPath, "utf8");
  assert.match(source, /require\(["']\.\/assessment-service["']\)/);
  assert.match(source, /assessmentService\.executeAction/);
  assert.match(source, /assessmentService\.executeStreamingAction/);
  assert.doesNotMatch(source, /require\(["']\.\.\/assessment-service["']\)/);
  assert.doesNotMatch(source, /require\(["']\.\.\/outcome-recommendation["']\)/);
  assert.doesNotMatch(source, /require\(["']\.\.\/pedagogical-repair["']\)/);
  assert.doesNotMatch(source, /require\(["']\.\.\/pedagogical-coverage["']\)/);
});

test("assessment application service owns action orchestration", () => {
  const source = fs.readFileSync(servicePath, "utf8");
  assert.match(source, /function isSupportedAction/);
  assert.match(source, /async function executeAction/);
  assert.match(source, /async function executeStreamingAction/);
  assert.doesNotMatch(source, /getDb\s*\(/);
  assert.doesNotMatch(source, /SELECT\s+/i);
});
