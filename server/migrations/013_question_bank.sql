CREATE TABLE IF NOT EXISTS question_bank (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT '',
  prompt TEXT NOT NULL DEFAULT '',
  focus TEXT NOT NULL DEFAULT '',
  outcome TEXT NOT NULL DEFAULT '',
  rubric TEXT NOT NULL DEFAULT '',
  ideal TEXT NOT NULL DEFAULT '',
  criteria TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_question_bank_tenant
  ON question_bank (tenant_id, teacher_id, created_at);