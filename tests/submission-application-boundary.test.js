const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const servicePath = path.join(root, "server", "application", "submission-service.js");
const controllerPath = path.join(root, "server", "application", "data-controller.js");
const evaluationPath = path.join(root, "server", "application", "evaluation-service.js");
const gatewayPath = path.join(root, "server", "database", "submission-gateway.js");
const repositoryPath = path.join(root, "server", "database", "submission-repository.js");

function read(file) { return fs.readFileSync(file, "utf8"); }

test("submission application service owns submission orchestration", () => {
  const source = read(servicePath);
  assert.match(source, /assertCanSubmit/);
  assert.match(source, /saveStudentSubmission/);
  assert.match(source, /saveTeacherSubmission/);
  assert.match(source, /getSubmission/);
  assert.doesNotMatch(source, /\b(?:SELECT|INSERT|UPDATE|DELETE)\b/i);
  assert.doesNotMatch(source, /require\(["']\.\.\/database\/client["']\)/);
  assert.doesNotMatch(source, /getDb\s*\(/);
  assert.match(source, /submissionGateway/);
});

test("data controller delegates submission actions", () => {
  const source = read(controllerPath);
  assert.match(source, /require\(["']\.\/submission-service["']\)/);
  assert.match(source, /submissionService\.getSubmission/);
  assert.match(source, /submissionService\.saveStudentSubmission/);
  assert.match(source, /submissionService\.saveTeacherSubmission/);
  assert.match(source, /submissionService\.saveComplaint/);
  assert.doesNotMatch(source, /\b(?:getSubmissionDetail|getSubmissionForUpdate|saveSubmission|saveComplaint)\s*,/);
});

test("evaluation application service delegates submission authorization", () => {
  const source = read(evaluationPath);
  assert.match(source, /require\(["']\.\/submission-service["']\)/);
  assert.match(source, /submissionService\.assertCanSubmit/);
  assert.doesNotMatch(source, /require\(["']\.\.\/database["']\)/);
  assert.doesNotMatch(source, /assertCanSubmitAssessment/);
});

test("submission gateway owns database client access", () => {
  const source = read(gatewayPath);
  assert.match(source, /require\(["']\.\/client["']\)/);
  assert.match(source, /getDb\s*\(/);
  assert.match(source, /submission-repository/);
});

test("submission repository remains persistence boundary", () => {
  const source = read(repositoryPath);
  assert.match(source, /db\.get|db\.run|db\.all/);
  assert.match(source, /submissions/);
});
