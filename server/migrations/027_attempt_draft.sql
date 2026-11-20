-- In-progress answers saved during the exam, so a reload or crash does not lose them.
-- Never used for scoring: the official answers are still the ones in answers_json.
ALTER TABLE assessment_attempts ADD COLUMN draft_json TEXT;
ALTER TABLE assessment_attempts ADD COLUMN draft_saved_at TEXT;
