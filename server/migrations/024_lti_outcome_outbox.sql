-- Durable, retryable queue for LTI Basic Outcomes score passback.
CREATE TABLE IF NOT EXISTS lti_outcome_outbox (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL,
  consumer_key TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  outcome_url TEXT NOT NULL,
  sourced_id TEXT NOT NULL,
  score REAL NOT NULL CHECK (score >= 0 AND score <= 100),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT,
  last_error TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (submission_id, consumer_key)
);
CREATE INDEX IF NOT EXISTS idx_lti_outcome_outbox_due
  ON lti_outcome_outbox(status, next_attempt_at, created_at);
