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


test("regrade refresh replaces the existing competency snapshot for the same assessment", async () => {
  const { materializeSubmission } = require("../server/competency-materializer");
  let state = null;
  const writes = [];
  const assessmentPayload = JSON.stringify({
    outcomes: [{ id: "LO1", text: "Menjelaskan konsep" }],
    questions: [{ learningOutcomeId: "LO1", prompt: "Jelaskan konsep" }],
  });
  const db = {
    async get(sql) {
      if (sql.includes("FROM assessments")) return { payload: assessmentPayload };
      if (sql.includes("FROM student_competency_state")) return state;
      throw new Error("Unexpected query");
    },
    async run(sql, ...args) {
      writes.push(args);
      state = {
        tenant_id: args[0],
        student_id: args[1],
        learning_outcome_id: args[2],
        learning_outcome: args[3],
        latest_score: args[4],
        latest_submitted_at: args[5],
        snapshot_count: args[6],
        history: args[7],
      };
      return { changes: 1 };
    },
  };
  const base = {
    id: "submission-1",
    assessmentId: "assessment-1",
    submittedAt: "2026-10-02T05:00:00.000Z",
    questionScores: [{ score: 60, evidence: [{ text: "konsep" }] }],
  };
  await materializeSubmission(db, "tenant-1", "student-1", base);
  assert.equal(state.latest_score, 60);
  assert.equal(state.snapshot_count, 1);
  await materializeSubmission(db, "tenant-1", "student-1", { ...base, questionScores: [{ score: 90, evidence: [{ text: "konsep" }] }] });
  assert.equal(state.latest_score, 90);
  assert.equal(state.snapshot_count, 1);
  assert.equal(JSON.parse(state.history).length, 1);
  assert.equal(writes.length, 2);
});
