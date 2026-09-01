const crypto = require("node:crypto");
const { getDb } = require("../database");
const { evaluateAssessment } = require("./evaluation-service");

const DEFAULT_MAX_ATTEMPTS = Number(process.env.EVALUATION_JOB_MAX_ATTEMPTS || 3);
const RETRY_DELAY_MS = Number(process.env.EVALUATION_JOB_RETRY_DELAY_MS || 1000);
const LEASE_MS = Number(process.env.EVALUATION_JOB_LEASE_MS || 5 * 60 * 1000);

function now() { return new Date().toISOString(); }
function future(ms) { return new Date(Date.now() + ms).toISOString(); }
function createJobId() { return `job_${crypto.randomBytes(8).toString("hex")}`; }

async function enqueueEvaluation(payload = {}) {
  if (!payload.tenantId) throw new Error("tenantId wajib ada");
  if (!Array.isArray(payload.answers)) throw new Error("answers array wajib ada");
  const db = getDb();
  const idempotencyKey = payload.idempotencyKey || null;
  const persistedPayload = { ...payload };
  delete persistedPayload.auth;
  delete persistedPayload.onProgress;
  delete persistedPayload.idempotencyKey;

  if (idempotencyKey) {
    const existing = await db.get(
      `SELECT id FROM evaluation_jobs WHERE tenant_id = ? AND idempotency_key = ?`,
      payload.tenantId, idempotencyKey
    );
    if (existing) return getEvaluationJob(existing.id, payload.tenantId);
  }

  const id = createJobId();
  const timestamp = now();
  try {
    await db.run(
      `INSERT INTO evaluation_jobs
        (id, tenant_id, user_id, status, payload, available_at, created_at, updated_at, idempotency_key)
       VALUES (?, ?, ?, 'queued', ?, ?, ?, ?, ?)`,
      id, payload.tenantId, payload.userId || null, JSON.stringify(persistedPayload), timestamp, timestamp, timestamp, idempotencyKey
    );
  } catch (error) {
    if (idempotencyKey && /unique|constraint/i.test(String(error.message || error))) {
      const existing = await db.get(`SELECT id FROM evaluation_jobs WHERE tenant_id = ? AND idempotency_key = ?`, payload.tenantId, idempotencyKey);
      if (existing) return getEvaluationJob(existing.id, payload.tenantId);
    }
    throw error;
  }
  return getEvaluationJob(id, payload.tenantId);
}

async function getEvaluationJob(id, tenantId) {
  const row = await getDb().get(
    `SELECT id, tenant_id, user_id, status, result, error, attempts,
            available_at, started_at, finished_at, created_at, updated_at,
            idempotency_key, lease_until, heartbeat_at
       FROM evaluation_jobs WHERE id = ? AND tenant_id = ?`, id, tenantId
  );
  if (!row) return null;
  return { ...row, result: row.result ? JSON.parse(row.result) : null };
}

/** Requeue abandoned jobs whose worker lease has expired. */
async function recoverExpiredJobs() {
  const timestamp = now();
  const result = await getDb().run(
    `UPDATE evaluation_jobs
        SET status = CASE WHEN attempts < ? THEN 'queued' ELSE 'failed' END,
            error = CASE WHEN attempts < ? THEN error ELSE COALESCE(error, 'worker lease expired') END,
            available_at = ?,
            finished_at = CASE WHEN attempts < ? THEN NULL ELSE ? END,
            lease_until = NULL,
            heartbeat_at = NULL,
            updated_at = ?
      WHERE status = 'running' AND lease_until IS NOT NULL AND lease_until <= ?`,
    DEFAULT_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS, timestamp, DEFAULT_MAX_ATTEMPTS, timestamp, timestamp, timestamp
  );
  return result?.changes || 0;
}

async function claimEvaluationJob() {
  const db = getDb();
  await recoverExpiredJobs();
  const candidate = await db.get(
    `SELECT id FROM evaluation_jobs
      WHERE status = 'queued' AND available_at <= ?
      ORDER BY created_at ASC LIMIT 1`, now()
  );
  if (!candidate) return null;
  const started = now();
  const claimed = await db.run(
    `UPDATE evaluation_jobs
        SET status = 'running', attempts = attempts + 1,
            started_at = ?, lease_until = ?, heartbeat_at = ?, updated_at = ?
      WHERE id = ? AND status = 'queued'`,
    started, future(LEASE_MS), started, started, candidate.id
  );
  if (!claimed || claimed.changes !== 1) return null;
  return db.get(`SELECT * FROM evaluation_jobs WHERE id = ?`, candidate.id);
}

async function heartbeatEvaluationJob(jobId) {
  const timestamp = now();
  const result = await getDb().run(
    `UPDATE evaluation_jobs SET heartbeat_at = ?, lease_until = ?, updated_at = ?
      WHERE id = ? AND status = 'running'`, timestamp, future(LEASE_MS), timestamp, jobId
  );
  return Boolean(result && result.changes === 1);
}

async function processEvaluationJob(job) {
  const payload = JSON.parse(job.payload);
  let timer;
  try {
    timer = setInterval(() => heartbeatEvaluationJob(job.id).catch(() => {}), Math.max(1000, Math.floor(LEASE_MS / 3)));
    const result = await evaluateAssessment(payload);
    const timestamp = now();
    await getDb().run(
      `UPDATE evaluation_jobs SET status = 'completed', result = ?, error = NULL,
              finished_at = ?, lease_until = NULL, heartbeat_at = NULL, updated_at = ?
        WHERE id = ? AND status = 'running'`,
      JSON.stringify(result), timestamp, timestamp, job.id
    );
    return result;
  } catch (error) {
    const timestamp = now();
    const attempts = Number(job.attempts || 0);
    const retryable = attempts < DEFAULT_MAX_ATTEMPTS;
    await getDb().run(
      `UPDATE evaluation_jobs SET status = ?, error = ?, available_at = ?,
              finished_at = ?, lease_until = NULL, heartbeat_at = NULL, updated_at = ?
        WHERE id = ? AND status = 'running'`,
      retryable ? 'queued' : 'failed', String(error.message || error), future(RETRY_DELAY_MS * Math.max(1, attempts)),
      retryable ? null : timestamp, timestamp, job.id
    );
    if (!retryable) throw error;
    return null;
  } finally {
    if (timer) clearInterval(timer);
  }
}

async function processNextEvaluationJob() {
  const job = await claimEvaluationJob();
  if (!job) return { processed: false };
  await processEvaluationJob(job);
  return { processed: true, jobId: job.id };
}

function startEvaluationWorker({ intervalMs = 250 } = {}) {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try { await processNextEvaluationJob(); }
    catch (error) { console.error("[evaluation-worker]", error.message || error); }
    finally { if (!stopped) setTimeout(tick, intervalMs); }
  };
  setTimeout(tick, 0);
  return () => { stopped = true; };
}

module.exports = {
  enqueueEvaluation, getEvaluationJob, claimEvaluationJob, processEvaluationJob,
  processNextEvaluationJob, startEvaluationWorker, recoverExpiredJobs, heartbeatEvaluationJob,
};
