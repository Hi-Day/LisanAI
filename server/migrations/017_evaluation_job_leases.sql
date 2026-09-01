-- Production hardening for async evaluation jobs.
-- idempotency_key prevents duplicate enqueue requests for the same logical job.
-- lease_until allows a worker to recover jobs abandoned by a crashed process.
-- heartbeat_at provides operational visibility for long-running evaluations.
ALTER TABLE evaluation_jobs ADD COLUMN idempotency_key TEXT;
ALTER TABLE evaluation_jobs ADD COLUMN lease_until TEXT;
ALTER TABLE evaluation_jobs ADD COLUMN heartbeat_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_evaluation_jobs_idempotency
  ON evaluation_jobs(tenant_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_lease
  ON evaluation_jobs(status, lease_until);
