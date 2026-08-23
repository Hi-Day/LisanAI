-- Make submissions.assessment_id nullable so a student's work is never lost
-- when the assessment row is missing from the DB (e.g. shown from frontend
-- state but never persisted, or deleted). SQLite cannot ALTER a column's
-- NOT NULL constraint, so we rebuild the table with the relaxed schema and
-- preserve existing rows.
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS submissions_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  assessment_id TEXT,
  student_name TEXT NOT NULL,
  user_id TEXT,
  final_score INTEGER NOT NULL,
  payload TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
);

INSERT INTO submissions_new (id, tenant_id, assessment_id, student_name, user_id, final_score, payload, submitted_at)
  SELECT id, tenant_id, assessment_id, student_name, user_id, final_score, payload, submitted_at
  FROM submissions;

DROP TABLE submissions;

ALTER TABLE submissions_new RENAME TO submissions;

CREATE INDEX IF NOT EXISTS idx_submissions_tenant ON submissions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assessment ON submissions (assessment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions (user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_assessment ON submissions (tenant_id, user_id, assessment_id);

PRAGMA foreign_keys = ON;