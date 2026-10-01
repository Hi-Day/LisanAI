ALTER TABLE question_bank ADD COLUMN learning_outcome_ids TEXT NOT NULL DEFAULT '[]';
ALTER TABLE question_bank ADD COLUMN learning_outcome_id TEXT NOT NULL DEFAULT '';

-- Existing rows remain compatible: their outcome text is retained and can be
-- rebound to the current assessment LO when imported. New rows persist stable
-- LO identifiers alongside the human-readable outcome text.
