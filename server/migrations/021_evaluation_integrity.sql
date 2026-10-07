-- Immutable evaluation snapshot hash for post-persistence integrity verification.
ALTER TABLE evaluation_runs ADD COLUMN evaluation_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_evaluation_runs_evaluation_hash
  ON evaluation_runs (tenant_id, evaluation_hash);
