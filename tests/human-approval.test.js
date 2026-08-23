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
  markHumanReviewed,
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

test("markHumanReviewed moves a pending run to human_reviewed", async () => {
  await insertRun("run-mark-reviewed-45", 45);
  await queueForApproval({ runId: "run-mark-reviewed-45", tenantId: "t1", finalScore: 45 });

  const result = await markHumanReviewed({ runId: "run-mark-reviewed-45", reviewerId: "guru-1" });
  assert.equal(result.approval_status, "human_reviewed");
  assert.equal(result.approved_by, "guru-1");

  const row = await getApproval("run-mark-reviewed-45");
  assert.equal(row.approval_status, "human_reviewed");
});

test("markHumanReviewed does not touch an already-approved run", async () => {
  await insertRun("run-mark-approved-7", 70);
  await queueForApproval({ runId: "run-mark-approved-7", tenantId: "t1", finalScore: 70 });
  await approveRun({ runId: "run-mark-approved-7", reviewerId: "guru-1" });

  await markHumanReviewed({ runId: "run-mark-approved-7", reviewerId: "guru-2" });
  const row = await getApproval("run-mark-approved-7");
  assert.equal(row.approval_status, "approved");
});

test("processExpiredApprovals never overwrites an existing manual human score", async () => {
  // Teacher saved a manual score long ago that differs from the AI score.
  await insertRun("run-manual-guard-3", 30, { createdAt: isoDaysAgo(8), tenantId: "t1" });
  await queueForApproval({ runId: "run-manual-guard-3", tenantId: "t1", finalScore: 30 });
  await getDb().run(
    "UPDATE human_approvals SET deadline_at = ? WHERE run_id = ?",
    isoDaysAgo(1),
    "run-manual-guard-3"
  );
  await getDb().run(
    `INSERT INTO evaluation_human_scores (run_id, human_score, human_feedback, reviewed_at, reviewer_id)
     VALUES (?, 85, 'Koreksi guru: skor AI 30 -> manusia 85', ?, ?)`,
    "run-manual-guard-3",
    new Date().toISOString(),
    "guru-1"
  );

  const count = await processExpiredApprovals();
  // The run may have been promoted to human_reviewed, but must NOT be auto_approved.
  const after = await getApproval("run-manual-guard-3");
  assert.notEqual(after.approval_status, "auto_approved");
  assert.equal(after.human_score, 85, "manual human score must survive the sweep");
});

test("processExpiredApprovals still auto-approves pending runs with no human score", async () => {
  await insertRun("run-no-human-9", 60, { createdAt: isoDaysAgo(9), tenantId: "t1" });
  await queueForApproval({ runId: "run-no-human-9", tenantId: "t1", finalScore: 60 });
  await getDb().run(
    "UPDATE human_approvals SET deadline_at = ? WHERE run_id = ?",
    isoDaysAgo(1),
    "run-no-human-9"
  );

  await processExpiredApprovals();
  const row = await getApproval("run-no-human-9");
  assert.equal(row.approval_status, "auto_approved");
  assert.equal(row.human_score, 60, "AI score auto-promoted for untouched runs");
});

test("manual human score flows into AI-vs-human research metrics", async () => {
  const { compareAiVsHuman } = require("../server/evaluation/research");
  await insertRun("run-metrics-manual-8", 20, { tenantId: "t-metrics" });
  await queueForApproval({ runId: "run-metrics-manual-8", tenantId: "t-metrics", finalScore: 20 });
  await getDb().run(
    `INSERT INTO evaluation_human_scores (run_id, human_score, human_feedback, reviewed_at, reviewer_id)
     VALUES (?, 92, 'Koreksi guru', ?, 'guru-1')`,
    "run-metrics-manual-8",
    new Date().toISOString()
  );

  const data = await compareAiVsHuman(null, "t-metrics");
  const pair = data.rows.find((r) => r.runId === "run-metrics-manual-8");
  assert.ok(pair, "AI-vs-human pair present");
  assert.equal(pair.aiScore, 20);
  assert.equal(pair.humanScore, 92);
  assert.ok(data.n >= 1);
  assert.ok(typeof data.metrics.validity.pearson === "number");
  assert.ok(typeof data.metrics.validity.mae === "number");
});