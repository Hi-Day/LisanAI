-- Durable async evaluation jobs.
-- Payload is JSON because the queue must preserve the exact evaluation input
-- across retries/process restarts. It is scoped by tenant for isolation.
CREATE TABLE IF NOT EXISTS evaluation_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  payload TEXT NOT NULL,
  result TEXT,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_claim
  ON evaluation_jobs(status, available_at, created_at);
CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_tenant
  ON evaluation_jobs(tenant_id, created_at DESC);
