const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const servicePath = path.join(root, "server", "application", "submission-service.js");
const evaluationPath = path.join(root, "server", "application", "evaluation-service.js");
const repositoryPath = path.join(root, "server", "database", "submission-repository.js");

function read(file) { return fs.readFileSync(file, "utf8"); }

test("submission application service owns submission orchestration", () => {
  const source = read(servicePath);
  assert.match(source, /assertCanSubmit/);
  assert.match(source, /saveStudentSubmission/);
  assert.match(source, /saveTeacherSubmission/);
  assert.match(source, /getSubmission/);
  assert.doesNotMatch(source, /\b(?:SELECT|INSERT|UPDATE|DELETE)\b/i);
});

test("evaluation application service delegates submission authorization", () => {
  const source = read(evaluationPath);
  assert.match(source, /require\(["']\.\/submission-service["']\)/);
  assert.match(source, /submissionService\.assertCanSubmit/);
  assert.doesNotMatch(source, /require\(["']\.\.\/database["']\)/);
  assert.doesNotMatch(source, /assertCanSubmitAssessment/);
});

test("submission repository remains persistence boundary", () => {
  const source = read(repositoryPath);
  assert.match(source, /getDb|db\.get|db\.run/);
  assert.match(source, /submissions/);
});
