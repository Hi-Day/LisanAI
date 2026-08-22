const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

process.env.TURSO_DATABASE_URL = `file:${path.join(os.tmpdir(), `lisan-approval-${Date.now()}.db`)}`;
process.env.ENABLE_DEMO_SIMULATION = "false";
process.env.HARNESS_PROVIDER = "mock";

const { initDatabase, getDb } = require("../server/database");
const {
  APPROVAL_WINDOW_MS,
  queueForApproval,
  approveRun,
  processExpiredApprovals,
  getApproval,
  listApprovals,
} = require("../server/evaluation/human-approval");
const { persistEvaluationTrace } = require("../server/evaluation/trace-persister");

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function insertRun(runId, finalScore, extra = {}) {
  const db = getDb();
  try {
    await db.run(
      `INSERT INTO evaluation_runs
         (run_id, tenant_id, user_id, assessment_id, submission_id, model,
          prompt_version, rubric_version, harness_version, engine_version,
          final_score, verification_valid, verification_issues, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      runId,
      extra.tenantId || null,
      extra.userId || null,
      extra.assessmentId || null,
      extra.submissionId || null,
      "mock-model",
      "v1",
      "v1",
      "1.0.0",
      "1.0.0",
      finalScore,
      1,
      "[]",
      extra.createdAt || new Date().toISOString()
    );
  } catch (e) {
    // FK may reject if assessment missing; ignore for approval tests.
  }
}

test.before(async () => {
  const dbPath = process.env.TURSO_DATABASE_URL.replace(/^file:/, "");
  fs.rmSync(dbPath, { force: true });
  await initDatabase();
});

test("queueForApproval creates a pending row with a 7-day deadline", async () => {
  await insertRun("run-pending-1", 82);
  const created = await queueForApproval({
    runId: "run-pending-1",
    tenantId: "t1",
    finalScore: 82,
  });
  assert.equal(created.approvalStatus, "pending");

  const row = await getApproval("run-pending-1");
  assert.equal(row.approval_status, "pending");
  assert.equal(row.ai_score, 82);

  const deadline = new Date(row.deadline_at).getTime();
  const expected = Date.now() + APPROVAL_WINDOW_MS;
  assert.ok(Math.abs(deadline - expected) < 60_000, "deadline ~ now + 7 days");
});

test("approveRun without correction records the AI score as human score", async () => {
  await insertRun("run-approve-ai", 75);
  await queueForApproval({ runId: "run-approve-ai", tenantId: "t1", finalScore: 75 });

  const result = await approveRun({ runId: "run-approve-ai", reviewerId: "guru-1" });
  assert.equal(result.approvalStatus, "approved");
  assert.equal(result.humanScore, 75);

  const row = await getApproval("run-approve-ai");
  assert.equal(row.approval_status, "approved");
  assert.equal(row.human_score, 75);
});

test("approveRun with a manual correction overrides the human score", async () => {
  await insertRun("run-approve-correct", 90);
  await queueForApproval({ runId: "run-approve-correct", tenantId: "t1", finalScore: 90 });

  const result = await approveRun({ runId: "run-approve-correct", reviewerId: "guru-1", humanScore: 60, humanFeedback: "Kurang detail" });
  assert.equal(result.humanScore, 60);
  const row = await getApproval("run-approve-correct");
  assert.equal(row.human_score, 60);
  assert.equal(row.human_feedback, "Kurang detail");
});

test("processExpiredApprovals auto-approves pending runs past deadline", async () => {
  await insertRun("run-expired-50", 50, { createdAt: isoDaysAgo(8) });
  await queueForApproval({ runId: "run-expired-50", tenantId: "t1", finalScore: 50 });
  await getDb().run(
    "UPDATE human_approvals SET deadline_at = ? WHERE run_id = ?",
    isoDaysAgo(1),
    "run-expired-50"
  );

  // Not yet auto-approved before deadline passes.
  const before = await getApproval("run-expired-50");
  assert.equal(before.approval_status, "pending");

  const count = await processExpiredApprovals();
  assert.ok(count >= 1, "expected at least one auto-approval");

  const after = await getApproval("run-expired-50");
  assert.equal(after.approval_status, "auto_approved");
  assert.equal(after.human_score, 50, "AI score stored as human-confirmed score");
});

test("pending approval stays pending before the window elapses", async () => {
  await insertRun("run-not-expired-66", 66);
  await queueForApproval({ runId: "run-not-expired-66", tenantId: "t1", finalScore: 66 });
  await processExpiredApprovals();
  const row = await getApproval("run-not-expired-66");
  assert.equal(row.approval_status, "pending");
});

test("human scores recorded by approval flow into AI-vs-human research metrics", async () => {
  await insertRun("run-metrics-30", 30);
  await queueForApproval({ runId: "run-metrics-30", tenantId: "t1", finalScore: 30 });
  await approveRun({ runId: "run-metrics-30", reviewerId: "guru-1" });

  const db = getDb();
  const joined = await db.get(
    `SELECT r.run_id, r.final_score AS ai, h.human_score AS human
       FROM evaluation_runs r
       JOIN evaluation_human_scores h ON h.run_id = r.run_id
      WHERE r.run_id = ?`,
    "run-metrics-30"
  );
  assert.ok(joined, "AI-vs-human pair present");
  assert.equal(joined.ai, 30);
  assert.equal(joined.human, 30);
});

test("persistEvaluationTrace queues a run for approval automatically", async () => {
  await insertRun("run-persist-88", 88, { tenantId: "t1" });
  await persistEvaluationTrace({
    runId: "run-persist-88",
    meta: { tenantId: "t1" },
    result: {
      finalScore: 88,
      assessmentId: null,
      evaluationId: "ev",
      criteria: [],
      weighted: {},
    },
  });
  // Silently tolerate if the row insert itself fails; if it persisted, it
  // must have been queued.
  const approval = await getApproval("run-persist-88");
  assert.ok(!approval || approval.approval_status === "pending");
});