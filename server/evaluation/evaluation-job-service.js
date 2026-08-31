const crypto = require("node:crypto");
const { getDb } = require("../database");
const { evaluateAssessment } = require("./evaluation-service");

const DEFAULT_MAX_ATTEMPTS = Number(process.env.EVALUATION_JOB_MAX_ATTEMPTS || 3);
const RETRY_DELAY_MS = Number(process.env.EVALUATION_JOB_RETRY_DELAY_MS || 1000);

function now() {
  return new Date().toISOString();
}

function createJobId() {
  return `job_${crypto.randomBytes(8).toString("hex")}`;
}

/** Queue work durably before any LLM call starts. */
async function enqueueEvaluation(payload = {}) {
  if (!payload.tenantId) throw new Error("tenantId wajib ada");
  if (!Array.isArray(payload.answers)) throw new Error("answers array wajib ada");

  const db = getDb();
  const id = createJobId();
  const timestamp = now();
  const persistedPayload = { ...payload };
  // Auth/session objects must never become part of the durable job payload.
  delete persistedPayload.auth;
  delete persistedPayload.onProgress;

  await db.run(
    `INSERT INTO evaluation_jobs
      (id, tenant_id, user_id, status, payload, available_at, created_at, updated_at)
     VALUES (?, ?, ?, 'queued', ?, ?, ?, ?)`,
    id,
    payload.tenantId,
    payload.userId || null,
    JSON.stringify(persistedPayload),
    timestamp,
    timestamp,
    timestamp
  );

  return getEvaluationJob(id, payload.tenantId);
}

async function getEvaluationJob(id, tenantId) {
  const row = await getDb().get(
    `SELECT id, tenant_id, user_id, status, result, error, attempts,
            available_at, started_at, finished_at, created_at, updated_at
       FROM evaluation_jobs
      WHERE id = ? AND tenant_id = ?`,
    id,
    tenantId
  );
  if (!row) return null;
  return {
    ...row,
    result: row.result ? JSON.parse(row.result) : null,
  };
}

/**
 * Claim one job. SQLite/Turso provides a transactional boundary here; the
 * update is conditional on status='queued' so two workers cannot both claim
 * the same row in the common case.
 */
async function claimEvaluationJob() {
  const db = getDb();
  const candidate = await db.get(
    `SELECT id FROM evaluation_jobs
      WHERE status = 'queued' AND available_at <= ?
      ORDER BY created_at ASC LIMIT 1`,
    now()
  );
  if (!candidate) return null;

  const started = now();
  const claimed = await db.run(
    `UPDATE evaluation_jobs
        SET status = 'running', attempts = attempts + 1,
            started_at = ?, updated_at = ?
      WHERE id = ? AND status = 'queued'`,
    started,
    started,
    candidate.id
  );
  if (!claimed || claimed.changes !== 1) return null;

  return db.get(`SELECT * FROM evaluation_jobs WHERE id = ?`, candidate.id);
}

async function processEvaluationJob(job) {
  const payload = JSON.parse(job.payload);
  try {
    const result = await evaluateAssessment(payload);
    const timestamp = now();
    await getDb().run(
      `UPDATE evaluation_jobs
          SET status = 'completed', result = ?, error = NULL,
              finished_at = ?, updated_at = ?
        WHERE id = ? AND status = 'running'`,
      JSON.stringify(result),
      timestamp,
      timestamp,
      job.id
    );
    return result;
  } catch (error) {
    const timestamp = now();
    const attempts = Number(job.attempts || 0);
    const retryable = attempts < DEFAULT_MAX_ATTEMPTS;
    await getDb().run(
      `UPDATE evaluation_jobs
          SET status = ?, error = ?, available_at = ?,
              finished_at = ?, updated_at = ?
        WHERE id = ? AND status = 'running'`,
      retryable ? 'queued' : 'failed',
      String(error.message || error),
      new Date(Date.now() + RETRY_DELAY_MS * attempts).toISOString(),
      retryable ? null : timestamp,
      timestamp,
      job.id
    );
    if (!retryable) throw error;
    return null;
  }
}

/** Process at most one queued job; safe to call from a request or worker loop. */
async function processNextEvaluationJob() {
  const job = await claimEvaluationJob();
  if (!job) return { processed: false };
  await processEvaluationJob(job);
  return { processed: true, jobId: job.id };
}

/** Start a lightweight in-process worker for local/serverful deployments. */
function startEvaluationWorker({ intervalMs = 250 } = {}) {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      await processNextEvaluationJob();
    } catch (error) {
      console.error("[evaluation-worker]", error.message || error);
    } finally {
      if (!stopped) setTimeout(tick, intervalMs);
    }
  };
  setTimeout(tick, 0);
  return () => { stopped = true; };
}

module.exports = {
  enqueueEvaluation,
  getEvaluationJob,
  claimEvaluationJob,
  processEvaluationJob,
  processNextEvaluationJob,
  startEvaluationWorker,
};
