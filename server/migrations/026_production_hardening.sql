-- Production hardening.

-- Answers are stored on the attempt at first submit, so an AI outage cannot lose
-- them and the deadline is judged by the first submit time, not by retries.
ALTER TABLE assessment_attempts ADD COLUMN answers_json TEXT;
ALTER TABLE assessment_attempts ADD COLUMN first_submitted_at TEXT;

-- Audio recordings live outside the submission JSON so list queries stay small.
CREATE TABLE IF NOT EXISTS submission_audio (
  submission_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  question_index INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('main','probing')),
  audio TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (submission_id, question_index, kind),
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);

-- 'validation' = lecturer released the AI score (not an independent rating);
-- such rows are excluded from AI-vs-human agreement metrics.
ALTER TABLE evaluation_human_scores ADD COLUMN source TEXT;

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at TEXT NOT NULL
);

-- One human score per run: repeated saves used to add rows and double-count in metrics.
DELETE FROM evaluation_human_scores WHERE id NOT IN (SELECT MAX(id) FROM evaluation_human_scores GROUP BY run_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_evaluation_human_scores_run ON evaluation_human_scores (run_id);
