const { getDb } = require("./client");

async function listEvaluationRuns(tenantId, assessmentId = null) {
  return getDb().all(
    `SELECT r.run_id, r.assessment_id, r.model, r.final_score,
            r.harness_version, r.prompt_version, r.verification_status,
            r.verification_valid, r.requires_human_review,
            a.approval_status, h.human_score
       FROM evaluation_runs r
       LEFT JOIN human_approvals a ON a.run_id = r.run_id
       LEFT JOIN evaluation_human_scores h ON h.run_id = r.run_id
      WHERE r.tenant_id = ?
        AND (? IS NULL OR r.assessment_id = ?)
      ORDER BY r.created_at DESC`,
    tenantId,
    assessmentId,
    assessmentId
  );
}

async function getEvaluationTrace(runId, tenantId) {
  const db = getDb();
  const run = await db.get(
    "SELECT * FROM evaluation_runs WHERE run_id = ? AND tenant_id = ?",
    runId,
    tenantId
  );
  if (!run) return { runId, available: false };

  const events = await db.all(
    "SELECT type, data, ts FROM evaluation_events WHERE run_id = ? ORDER BY seq ASC",
    runId
  );
  const result = await db.get("SELECT * FROM evaluation_results WHERE run_id = ?", runId);
  const versions = await db.get("SELECT * FROM evaluation_versions WHERE run_id = ?", runId);

  return {
    runId,
    available: true,
    run,
    events: events.map((event) => ({
      type: event.type,
      data: JSON.parse(event.data || "{}"),
      ts: event.ts,
    })),
    result: result ? JSON.parse(result.result_json) : null,
    versions,
  };
}

module.exports = { listEvaluationRuns, getEvaluationTrace };
