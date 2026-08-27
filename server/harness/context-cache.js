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
 *  3. Caches the compiled context artifact (systemPrompt + rubric + plan) in
 *     memory so repeated context construction is avoided (P1-1 G1).
 *  4. Emits hit/miss so the trace can show cache behavior (P1-1).
 *
 * SAFETY: the cached artifact is the compiled CONTEXT, never the evaluation
 * result. The model still runs per student; evidence validation and the
 * verification gate always run. Risk/verification logic is untouched.
 */

const crypto = require("node:crypto");

// Bump when the context compilation format/prompt template changes. This makes
// every produced contextVersion change, which invalidates the cache and makes
// traces unambiguous about which compiler version built them.
const CONTEXT_SCHEMA_VERSION = "1";

// In-memory cache: key `tenantId:contextHash` -> artifact. Bounded size to
// avoid unbounded growth; LRU eviction keeps hot assessments resident.
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
 * Cache lookup. Returns the compiled artifact on a hit, else null.
 * Recording the miss/hit is the caller's responsibility via trace events.
 */
function get(tenantId, contextHash) {
  const key = `${tenantId || ""}:${contextHash}`;
  const hit = store.get(key);
  if (hit) {
    // Refresh recency (LRU) and bump hit counter.
    store.delete(key);
    store.set(key, hit);
    stats.hits += 1;
    return hit;
  }
  stats.misses += 1;
  return null;
}

/**
 * Store a compiled context artifact (immutable by key — a change in any stable
 * field yields a new hash, so an existing key is never silently overwritten).
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
 * Cache telemetry (P1-1 metrics: context_cache_hit_rate, ...).
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
  CONTEXT_SCHEMA_VERSION,
};