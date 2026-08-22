-- Reproducibility + publication gate persistence (PRD FR-13, FR-15).
-- Stores the reproducibility hashes and the publication decision derived
-- from the verification gate so dashboards/research can audit them without
-- re-parsing result_json.

ALTER TABLE evaluation_runs ADD COLUMN input_hash TEXT;
ALTER TABLE evaluation_runs ADD COLUMN rubric_hash TEXT;
ALTER TABLE evaluation_runs ADD COLUMN prompt_hash TEXT;
ALTER TABLE evaluation_runs ADD COLUMN config_hash TEXT;
ALTER TABLE evaluation_runs ADD COLUMN published INTEGER;
ALTER TABLE evaluation_runs ADD COLUMN requires_human_review INTEGER;