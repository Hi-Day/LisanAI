-- P1: Evaluation Intelligence — cost attribution, context versioning, risk/policy.
-- All changes are additive (ALTER TABLE / new columns) so existing rows and
-- consumers keep working. PRD P1-1/P1-3 (context), P1-4/5/17 (risk/policy),
-- P1-13 (cost attribution to a specific evaluation run).

-- Link an AI log line to the evaluation run it served (P1-13). This is what
-- makes `ai_logs.cost_usd` attributable to a specific evaluation run so
-- cost_per_question / cost_per_published_score can be derived.
ALTER TABLE ai_logs ADD COLUMN run_id TEXT;

CREATE INDEX IF NOT EXISTS idx_ai_logs_run ON ai_logs (run_id);

-- Stable-context identity + version (P1-1/P1-3). context_hash is the SHA-256
-- of the STABLE evaluation context (system prompt + rubric + question set +
-- sampling + model), deliberately NOT the student answers.
ALTER TABLE evaluation_runs ADD COLUMN context_hash TEXT;
ALTER TABLE evaluation_runs ADD COLUMN context_version TEXT;

-- Risk classification + policy decision (P1-4/P1-5/P1-17). risk_level is one of
-- LOW|MEDIUM|HIGH. policy_applied records the risk-based treatment decision.
ALTER TABLE evaluation_runs ADD COLUMN risk_score REAL;
ALTER TABLE evaluation_runs ADD COLUMN risk_level TEXT;
ALTER TABLE evaluation_runs ADD COLUMN policy_applied TEXT;