const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const servicePath = path.join(root, "server", "evaluation", "research.js");
const repositoryPath = path.join(root, "server", "database", "research-repository.js");

test("research service delegates persistence to repository", () => {
  const source = fs.readFileSync(servicePath, "utf8");
  assert.doesNotMatch(source, /require\(["']\.\.\/database["']\)/);
  assert.doesNotMatch(source, /getDb\s*\(/);
  assert.doesNotMatch(source, /SELECT\s+/i);
  assert.match(source, /researchRepository/);
});

test("research repository owns research SQL", () => {
  const source = fs.readFileSync(repositoryPath, "utf8");
  assert.match(source, /getDb\s*\(/);
  assert.match(source, /SELECT\s+/i);
  assert.match(source, /evaluation_human_scores/);
  assert.match(source, /evaluation_runs/);
});
