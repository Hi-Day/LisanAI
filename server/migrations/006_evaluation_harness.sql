-- Assessment Harness evaluation persistence (PRD §26)

-- Evaluation run metadata (one per harness evaluate()).
CREATE TABLE IF NOT EXISTS evaluation_runs (
  run_id TEXT PRIMARY KEY,
  tenant_id TEXT,
  user_id TEXT,
  assessment_id TEXT,
  submission_id TEXT,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  rubric_version TEXT NOT NULL,
  harness_version TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  final_score REAL,
  verification_valid INTEGER,
  verification_issues TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_evaluation_runs_assessment ON evaluation_runs (assessment_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_runs_created ON evaluation_runs (created_at);

-- Append-only event log for a run (trace).
CREATE TABLE IF NOT EXISTS evaluation_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  type TEXT NOT NULL,
  data TEXT,
  ts TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES evaluation_runs(run_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evaluation_events_run ON evaluation_events (run_id, seq);

-- Result payload (canonical output snapshot).
CREATE TABLE IF NOT EXISTS evaluation_results (
  run_id TEXT PRIMARY KEY,
  evaluation_id TEXT NOT NULL,
  criteria_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  weighted_json TEXT,
  FOREIGN KEY (run_id) REFERENCES evaluation_runs(run_id) ON DELETE CASCADE
);

-- Per-criterion scores + evidence (denormalized for metrics/research).
CREATE TABLE IF NOT EXISTS evaluation_criteria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  criterion_id TEXT NOT NULL,
  score REAL NOT NULL,
  weight REAL NOT NULL,
  rationale TEXT,
  confidence REAL,
  evidence_json TEXT,
  FOREIGN KEY (run_id) REFERENCES evaluation_runs(run_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evaluation_criteria_run ON evaluation_criteria (run_id);

-- Versioning identifiers per run.
CREATE TABLE IF NOT EXISTS evaluation_versions (
  run_id TEXT PRIMARY KEY,
  model_version TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  rubric_version TEXT NOT NULL,
  harness_version TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES evaluation_runs(run_id) ON DELETE CASCADE
);

-- Human evaluation scores for AI-vs-human research (PRD §22).
CREATE TABLE IF NOT EXISTS evaluation_human_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  human_score INTEGER,
  human_feedback TEXT,
  reviewed_at TEXT,
  reviewer_id TEXT,
  FOREIGN KEY (run_id) REFERENCES evaluation_runs(run_id) ON DELETE CASCADE
);