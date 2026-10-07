-- Recover attempts left in SUBMITTING by a crashed evaluation worker.
ALTER TABLE assessment_attempts ADD COLUMN evaluation_started_at TEXT;
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_submission_lease
  ON assessment_attempts (tenant_id, status, evaluation_started_at);