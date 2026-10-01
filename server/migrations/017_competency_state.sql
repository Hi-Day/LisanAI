CREATE TABLE IF NOT EXISTS student_competency_state (
  tenant_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  learning_outcome_id TEXT NOT NULL,
  learning_outcome TEXT NOT NULL,
  latest_score INTEGER NOT NULL,
  latest_submitted_at TEXT,
  snapshot_count INTEGER NOT NULL DEFAULT 0,
  history TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, student_id, learning_outcome_id, learning_outcome)
);

CREATE INDEX IF NOT EXISTS idx_competency_state_student
  ON student_competency_state (tenant_id, student_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_competency_state_outcome
  ON student_competency_state (tenant_id, learning_outcome_id);
