/**
 * P1-1 / P1-3 — Evaluation Context Cache & Versioning.
 *
 * A compiled evaluation "context" (the STABLE system prompt + rubric + question
 * set + sampling config) is identical across every student submission of the
 * same assessment. Recomputing it repeatedly is wasted work, and auditing which
 * context produced a result requires a stable identity.
 *
 * This module:
 *  1. Derives a deterministic SHA-256 `contextHash` from the STABLE context
 *     only. It deliberately EXCLUDES student answers, names, and submission IDs
 *     (P1-2), so it never leaks a student across submissions and never causes a
 *     false miss when the volatile tail changes.
 *  2. Namespaces by tenant (P1-1) so a hash is never shared across boundaries.
 *  3. Caches the compiled context artifact (systemPrompt + rubric + plan).
 *
 * CACHING LAYERS
 *  - In-memory LRU (`store`): the fast path, hit-rate resets on restart.
 *  - Durable backing (`evaluation_contexts` table): survives restarts and is
 *    shared across instances, so hit-rate is NOT lost on a restart and the
 *    P1-1 target (≥80% hit) holds across restarts.
 *
 * The hot `get()` remains synchronous and I/O-free; DB read/write happens only
 * via the explicit async `load()`/`persist()` helpers, which the harness calls
 * outside the request path. This keeps the cache from adding latency.
 *
 * SAFETY: the cached artifact is the compiled CONTEXT, never the evaluation
 * result. The model still runs per student; evidence validation and the
 * verification gate always run.
 */

const crypto = require("node:crypto");

// Bump when the context compilation format/prompt template changes.
const CONTEXT_SCHEMA_VERSION = "1";

// In-memory cache: key `tenantId:contextHash` -> artifact. Bounded LRU.
const MAX_ENTRIES = 500;
const store = new Map();
const stats = { hits: 0, misses: 0 };

/**
 * Compute the canonical JSON for hashing from the stable context fields.
 * Any field that varies per student MUST NOT be passed here.
 */
function canonicalContext({ rubric, questions, model, temperature, topP, maxTokens, promptTemplate, harnessVersion, engineVersion, promptVersion }) {
  return JSON.stringify({
    schema: CONTEXT_SCHEMA_VERSION,
    rubric: rubric || null,
    questions: questions || null,
    model: model || null,
    temperature: temperature ?? null,
    topP: topP ?? null,
    maxTokens: maxTokens ?? null,
    promptTemplate: promptTemplate || null,
    harnessVersion: harnessVersion || null,
    engineVersion: engineVersion || null,
    promptVersion: promptVersion || null,
  });
}

/**
 * Deterministic SHA-256 of the STABLE context, namespaced by tenantId.
 * @returns {string} hex digest (64 chars).
 */
function computeContextHash({ tenantId, ...stable }) {
  const canonical = canonicalContext(stable);
  return crypto.createHash("sha256").update(`${tenantId || ""}:${canonical}`).digest("hex");
}

/**
 * Human/semantic context version string, e.g. "ctx-v1-<hash8>".
 */
function computeContextVersion(hash) {
  return `ctx-v${CONTEXT_SCHEMA_VERSION}-${String(hash || "").slice(0, 8)}`;
}

/**
 * Synchronous cache lookup (fast path, no I/O). Returns the artifact on a hit.
 * A DB-backed miss is handled by the async `resolve()` helper.
 */
function get(tenantId, contextHash) {
  const key = `${tenantId || ""}:${contextHash}`;
  const hit = store.get(key);
  if (hit) {
    store.delete(key);
    store.set(key, hit);
    stats.hits += 1;
    return hit;
  }
  stats.misses += 1;
  return null;
}

/**
 * Store an artifact in the in-memory cache (immutable by key).
 */
function set(tenantId, contextHash, artifact) {
  const key = `${tenantId || ""}:${contextHash}`;
  if (store.has(key)) return store.get(key);
  store.set(key, artifact);
  if (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    store.delete(oldest);
  }
  return artifact;
}

/**
 * Check the durable DB backing and load a context into memory if present.
 * Returns the artifact (or null). Reads the DB only when the in-memory cache
 * missed, and is safe to call per evaluation.
 * @param {string} tenantId
 * @param {string} contextHash
 * @returns {Promise<object|null>}
 */
async function refreshFromDb(tenantId, contextHash) {
  let db;
  try {
    db = require("../database").getDb();
  } catch (err) {
    return null;
  }
  if (!db) return null;
  try {
    const row = await db.get(
      "SELECT artifact_json FROM evaluation_contexts WHERE tenant_id = ? AND context_hash = ?",
      tenantId || null,
      contextHash
    );
    if (!row || !row.artifact_json) return null;
    let artifact;
    try {
      artifact = JSON.parse(row.artifact_json);
    } catch (err) {
      return null;
    }
    return set(tenantId, contextHash, artifact);
  } catch (err) {
    return null;
  }
}

/**
 * Persist a compiled context to the durable backing (best-effort, never throws
 * to the request path). Fire-and-forget is safe because the in-memory copy is
 * already live.
 */
async function persistToDb(tenantId, contextHash, contextVersion, artifact) {
  let db;
  try {
    db = require("../database").getDb();
  } catch (err) {
    return;
  }
  const now = new Date().toISOString();
  try {
    await db.run(
      `INSERT INTO evaluation_contexts (tenant_id, context_hash, context_version, artifact_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, context_hash) DO UPDATE SET
         artifact_json = excluded.artifact_json,
         context_version = excluded.context_version,
         updated_at = excluded.updated_at`,
      tenantId || null,
      contextHash,
      contextVersion,
      JSON.stringify(artifact),
      now,
      now
    );
  } catch (err) {
    // Non-fatal: the in-memory cache still serves this request.
    console.error("persistToDb FAILED:", err && err.message);
  }
}

/**
 * Hybrid lookup: check memory, then DB. Returns the artifact or null.
 * Best-effort; DB failures degrade to a memory-only cache (never throws).
 */
async function getWithPersistence(tenantId, contextHash) {
  const mem = get(tenantId, contextHash);
  if (mem) return mem;
  return refreshFromDb(tenantId, contextHash);
}

/**
 * Cache telemetry (P1-1 metrics: context_cache_hit_rate, ...). Counters are
 * process-local (memory fast-path hits vs misses).
 */
function getStats() {
  const total = stats.hits + stats.misses;
  return {
    hits: stats.hits,
    misses: stats.misses,
    size: store.size,
    maxSize: MAX_ENTRIES,
    hitRate: total > 0 ? round(stats.hits / total, 4) : null,
  };
}

/** Test helper: reset the in-memory cache + counters. */
function reset() {
  store.clear();
  stats.hits = 0;
  stats.misses = 0;
}

function round(v, places = 4) {
  const f = 10 ** places;
  return Math.round((v + Number.EPSILON) * f) / f;
}

module.exports = {
  computeContextHash,
  computeContextVersion,
  canonicalContext,
  get,
  set,
  getStats,
  reset,
  getWithPersistence,
  refreshFromDb,
  persistToDb,
  CONTEXT_SCHEMA_VERSION,
};