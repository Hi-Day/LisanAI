-- How often the pending-evaluation sweep has tried an attempt, so a permanently
-- failing one stops being retried instead of calling the model forever.
ALTER TABLE assessment_attempts ADD COLUMN evaluation_retry_count INTEGER NOT NULL DEFAULT 0;
