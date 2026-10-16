-- Assessment integrity hardening: server-authoritative attempts, deadlines,
-- immutable assessment snapshots and idempotent evaluation finalization.

CREATE TABLE IF NOT EXISTS assessment_attempts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  attempt_no INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('STARTED','SUBMITTING','FINALIZED','EXPIRED','CANCELLED')),
  assessment_hash TEXT NOT NULL,
  rubric_hash TEXT,
  snapshot_json TEXT NOT NULL,
  started_at TEXT NOT NULL,
  deadline_at TEXT,
  submitted_at TEXT,
  submission_id TEXT,
  idempotency_key TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, assessment_id, user_id, attempt_no),
  UNIQUE (tenant_id, assessment_id, user_id, idempotency_key),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_user
  ON assessment_attempts (tenant_id, user_id, assessment_id, status);

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_deadline
  ON assessment_attempts (tenant_id, deadline_at, status);

ALTER TABLE submissions ADD COLUMN attempt_id TEXT;
ALTER TABLE submissions ADD COLUMN assessment_hash TEXT;
ALTER TABLE submissions ADD COLUMN rubric_hash TEXT;
ALTER TABLE submissions ADD COLUMN submission_hash TEXT;
ALTER TABLE submissions ADD COLUMN evaluation_status TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_attempt
  ON submissions (tenant_id, attempt_id);

ALTER TABLE evaluation_runs ADD COLUMN attempt_id TEXT;
ALTER TABLE evaluation_runs ADD COLUMN assessment_hash TEXT;
ALTER TABLE evaluation_runs ADD COLUMN answer_hash TEXT;
