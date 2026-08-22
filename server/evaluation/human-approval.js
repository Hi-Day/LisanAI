const { getDb } = require("../database");

/**
 * Human approval workflow (PRD §22).
 *
 * Every harness evaluation run is queued for human review. The teacher can
 * explicitly approve the AI score (with an optional manual correction). If the
 * teacher takes no action within APPROVAL_WINDOW_MS (7 * 24h), the AI score is
 * automatically treated as human-confirmed and recorded in
 * evaluation_human_scores so it becomes part of the research dataset.
 */

const APPROVAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7×24 jam

function nowIso() {
  return new Date().toISOString();
}

function toIso(v) {
  return v instanceof Date ? v.toISOString() : String(v || nowIso());
}

/**
 * Queue a run for human approval if it is not already pending/decided.
 */
async function queueForApproval({ runId, tenantId, finalScore }) {
  if (!runId) return null;
  const db = getDb();
  const createdAt = nowIso();
  const deadline = new Date(Date.now() + APPROVAL_WINDOW_MS).toISOString();
  await db.run(
    `INSERT OR IGNORE INTO human_approvals
       (run_id, tenant_id, final_score, approval_status, deadline_at, created_at)
     VALUES (?, ?, ?, 'pending', ?, ?)`,
    runId,
    tenantId || null,
    finalScore ?? null,
    deadline,
    createdAt
  );
  return { runId, approvalStatus: "pending", deadlineAt: deadline };
}

/**
 * Teacher explicitly approves (or corrects) the score for a run.
 * When a custom humanScore is provided it is recorded as the human score;
 * otherwise the AI score snapshot is treated as approved as-is.
 */
async function approveRun({ runId, reviewerId, humanScore, humanFeedback }) {
  const db = getDb();
  const run = await db.get("SELECT run_id FROM evaluation_runs WHERE run_id = ?", runId);
  if (!run) throw Object.assign(new Error("Evaluation run tidak ditemukan"), { status: 404 });
  const existing = await db.get("SELECT * FROM human_approvals WHERE run_id = ?", runId);
  const aiScore = existing?.final_score ?? run.final_score ?? humanScore;

  const finalHumanScore =
    humanScore !== undefined && humanScore !== null && humanScore !== "" && Number.isFinite(Number(humanScore))
      ? Math.max(0, Math.min(100, Math.round(Number(humanScore))))
      : (aiScore == null ? null : Number(aiScore));

  const appliedAt = nowIso();

  await db.run(
    `INSERT INTO human_approvals
       (run_id, tenant_id, final_score, approval_status, approved_by, approved_at, deadline_at, created_at)
     VALUES (?, ?, ?, 'approved', ?, ?, ?, ?)
     ON CONFLICT(run_id) DO UPDATE SET
       approval_status = 'approved',
       approved_by = excluded.approved_by,
       approved_at = excluded.approved_at,
       final_score = excluded.final_score,
       tenant_id = COALESCE(human_approvals.tenant_id, excluded.tenant_id)`,
    runId,
    existing?.tenant_id || null,
    aiScore == null ? null : Number(aiScore),
    reviewerId || null,
    appliedAt,
    existing?.deadline_at || new Date(Date.now() + APPROVAL_WINDOW_MS).toISOString(),
    existing?.created_at || nowIso()
  );

  // Persist the confirmed human score so it flows into AI-vs-human research.
  await saveHumanScoreInternal({
    runId,
    humanScore: finalHumanScore,
    humanFeedback,
    reviewerId,
    reviewedAt: appliedAt,
  });

  return {
    runId,
    approvalStatus: "approved",
    humanScore: finalHumanScore,
    approvedAt: appliedAt,
  };
}

async function saveHumanScoreInternal({ runId, humanScore, humanFeedback, reviewerId, reviewedAt }) {
  const db = getDb();
  await db.run(
    `INSERT OR REPLACE INTO evaluation_human_scores
       (run_id, human_score, human_feedback, reviewed_at, reviewer_id)
     VALUES (?, ?, ?, ?, ?)`,
    runId,
    humanScore == null ? null : Number(humanScore),
    humanFeedback || null,
    toIso(reviewedAt),
    reviewerId || null
  );
}

/**
 * Sweep runs whose deadline has passed and who are still pending. Their AI
 * score is auto-promoted to a human-confirmed score (`auto_approved`).
 * Returns the number of runs auto-approved in this pass.
 */
async function processExpiredApprovals(now = new Date()) {
  const db = getDb();
  const ts = toIso(now);
  const expired = await db.all(
    `SELECT run_id, final_score, tenant_id
       FROM human_approvals
      WHERE approval_status = 'pending'
        AND deadline_at <= ?`,
    ts
  );
  for (const row of expired) {
    await saveHumanScoreInternal({
      runId: row.run_id,
      humanScore: row.final_score,
      humanFeedback: "Otomatis dikonfirmasi: guru tidak memberi keputusan dalam 7 hari.",
      reviewerId: null,
      reviewedAt: ts,
    });
    await db.run(
      `UPDATE human_approvals
          SET approval_status = 'auto_approved', approved_at = ?
        WHERE run_id = ?`,
      ts,
      row.run_id
    );
  }
  return expired.length;
}

/**
 * Get approval info (joined with human score) for a run, or null.
 */
async function getApproval(runId) {
  const db = getDb();
  return db.get(
    `SELECT a.run_id, a.final_score AS ai_score, a.approval_status, a.approved_by,
            a.approved_at, a.deadline_at,
            h.human_score, h.human_feedback, h.reviewed_at
       FROM human_approvals a
       LEFT JOIN evaluation_human_scores h ON h.run_id = a.run_id
      WHERE a.run_id = ?`,
    runId
  );
}

/**
 * List approval rows optionally filtered by tenant/assessment, with an
 * optional eager sweep so expired runs are auto-approved before returning.
 */
async function listApprovals({ tenantId, assessmentId, sweep = true } = {}) {
  const db = getDb();
  if (sweep) await processExpiredApprovals();
  const rows = await db.all(
    `SELECT a.run_id, a.approval_status, a.final_score AS ai_score,
            a.approved_by, a.approved_at, a.deadline_at,
            h.human_score, h.human_feedback
       FROM human_approvals a
       LEFT JOIN evaluation_human_scores h ON h.run_id = a.run_id
       LEFT JOIN evaluation_runs r ON r.run_id = a.run_id
      WHERE ($1 IS NULL OR a.tenant_id = $1)
        AND ($2 IS NULL OR r.assessment_id = $2)
      ORDER BY datetime(a.deadline_at) ASC`,
    tenantId || null,
    assessmentId || null
  );
  return rows;
}

module.exports = {
  APPROVAL_WINDOW_MS,
  queueForApproval,
  approveRun,
  processExpiredApprovals,
  getApproval,
  listApprovals,
};