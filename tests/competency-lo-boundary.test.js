const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const apiPath = path.join(root, "api", "competency-trajectory.js");
const servicePath = path.join(root, "server", "application", "competency-service.js");
const repositoryPath = path.join(root, "server", "database", "competency-repository.js");

test("competency API delegates trajectory work to application service", () => {
  const source = fs.readFileSync(apiPath, "utf8");
  assert.match(source, /require\(["']\.\.\/server\/application\/competency-service["']\)/);
  assert.match(source, /competencyService\.execute/);
  assert.doesNotMatch(source, /getDb\s*\(/);
  assert.doesNotMatch(source, /SELECT\s+/i);
  assert.doesNotMatch(source, /questionOutcomeMap/);
});

test("competency application service owns LO aggregation", () => {
  const source = fs.readFileSync(servicePath, "utf8");
  assert.match(source, /parseLearningOutcomes/);
  assert.match(source, /questionOutcomeMap/);
  assert.match(source, /buildCompetencyTrajectory/);
  assert.match(source, /competencyRepository/);
  assert.doesNotMatch(source, /getDb\s*\(/);
  assert.doesNotMatch(source, /SELECT\s+/i);
});

test("competency repository owns persistence queries", () => {
  const source = fs.readFileSync(repositoryPath, "utf8");
  assert.match(source, /getDb\s*\(/);
  assert.match(source, /SELECT\s+/i);
  assert.match(source, /assessments/);
  assert.match(source, /submissions/);
});
