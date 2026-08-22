-- Add verification gate status column to evaluation_runs (PRD FR-08).
-- Persists the harness verification gate decision (PASS | REVIEW | FAIL)
-- so the dashboard can show it without parsing result_json.
ALTER TABLE evaluation_runs ADD COLUMN verification_status TEXT;