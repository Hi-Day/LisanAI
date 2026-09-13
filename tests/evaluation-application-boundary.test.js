const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const controllerPath = path.join(root, "server", "application", "evaluation-controller.js");
const servicePath = path.join(root, "server", "application", "evaluation-service.js");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

test("evaluation controller delegates orchestration to application service", () => {
  const source = read(controllerPath);
  assert.match(source, /require\(["']\.\/evaluation-service["']\)/);
  assert.match(source, /evaluationService\.executeAction/);
  assert.match(source, /evaluationService\.executeStreamingAction/);
  assert.match(source, /evaluationService\.assertCanEvaluate/);
  assert.doesNotMatch(source, /require\(["']\.\.\/harness\/harness-evaluator["']\)/);
  assert.doesNotMatch(source, /require\(["']\.\.\/adaptive-probing["']\)/);
  assert.doesNotMatch(source, /require\(["']\.\.\/assessment\/probing-service["']\)/);
  assert.doesNotMatch(source, /require\(["']\.\.\/database["']\)/);
  assert.doesNotMatch(source, /getDb\s*\(/);
  assert.doesNotMatch(source, /\b(?:SELECT|INSERT|UPDATE|DELETE)\b/i);
});

test("evaluation application service owns evaluation and probing orchestration", () => {
  const source = read(servicePath);
  assert.match(source, /function isSupportedAction/);
  assert.match(source, /async function executeAction/);
  assert.match(source, /async function executeStreamingAction/);
  assert.match(source, /buildAdaptiveProbe/);
  assert.match(source, /assertCanEvaluate/);
  assert.doesNotMatch(source, /getDb\s*\(/);
  assert.doesNotMatch(source, /\b(?:SELECT|INSERT|UPDATE|DELETE)\b/i);
});
