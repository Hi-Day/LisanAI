const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

test("materializer keeps bounded history and uses learning-outcome alignment", () => {
  const source = fs.readFileSync(path.join(root, "server", "competency-materializer.js"), "utf8");
  assert.match(source, /questionLearningOutcomesMap/);
  assert.match(source, /slice\(-30\)/);
  assert.match(source, /student_competency_state/);
});

test("student competency service reads materialized state before raw submissions", () => {
  const source = fs.readFileSync(path.join(root, "server", "application", "competency-service.js"), "utf8");
  assert.match(source, /listStudentCompetencyStates/);
  assert.match(source, /stateToTrajectory/);
  assert.match(source, /replaceStudentCompetencyStates/);
});

test("submission persistence refreshes competency state", () => {
  const source = fs.readFileSync(path.join(root, "server", "database", "submission-repository.js"), "utf8");
  assert.match(source, /require\("\.\.\/competency-materializer"\)/);
  assert.match(source, /await refreshCompetencyState\(db, tenantId, userId, submission\)/);
  assert.match(source, /updateSubmissionFeedback[\s\S]*refreshCompetencyState/);
});

test("materialized competency state has student and outcome indexes", () => {
  const source = fs.readFileSync(path.join(root, "server", "migrations", "017_competency_state.sql"), "utf8");
  assert.match(source, /PRIMARY KEY \(tenant_id, student_id, learning_outcome_id, learning_outcome\)/);
  assert.match(source, /idx_competency_state_student/);
  assert.match(source, /idx_competency_state_outcome/);
});
