-- P1-1b — Durable Evaluation Context cache.
--
-- Persists compiled evaluation contexts (stable context hash → artifact) so the
-- context-cache survives server restarts and is shared across instances. The
-- in-memory cache remains the fast path; this table is the durable backing.
--
-- context_hash is the tenant-scoped SHA-256 of the STABLE context (system
-- prompt + rubric + question set + sampling + model). Artifacts are immutable:
-- any change in a stable field yields a new hash, so a row is never overwritten
-- in place — a re-compile simply creates/updates that key with a newer payload.

CREATE TABLE IF NOT EXISTS evaluation_contexts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  context_hash TEXT NOT NULL,
  context_version TEXT NOT NULL,
  artifact_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, context_hash)
);

CREATE INDEX IF NOT EXISTS idx_evaluation_contexts_tenant
  ON evaluation_contexts (tenant_id, context_hash);

-- Optional expiry: NULL = never expires (cache entries only turn over when the
-- LRU/DB cap evicts them or the context changes).
ALTER TABLE evaluation_contexts ADD COLUMN expires_at TEXT;