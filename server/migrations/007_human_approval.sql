-- Human approval of AI scores for research (PRD §22).
-- Tracks the review state of each evaluation run and supports automatic
-- "human-confirmed" capture when the teacher does not act within 7 days.

CREATE TABLE IF NOT EXISTS human_approvals (
  run_id TEXT PRIMARY KEY,
  tenant_id TEXT,
  final_score REAL,                    -- AI score snapshot at queue time
  approval_status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | auto_approved | rejected
  approved_by TEXT,
  approved_at TEXT,
  deadline_at TEXT NOT NULL,           -- created_at + 7*24h
  created_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES evaluation_runs(run_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_human_approvals_pending
  ON human_approvals (approval_status, deadline_at);