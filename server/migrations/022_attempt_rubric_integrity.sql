-- Keep the immutable assessment-attempt rubric binding separate from the
-- reproducibility rubric hash used by research and benchmark analysis.
ALTER TABLE evaluation_runs ADD COLUMN attempt_rubric_hash TEXT;
