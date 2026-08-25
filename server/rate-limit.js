/**
 * Rate limiter with DB-backed persistence for serverless environments.
 *
 * Uses an in-memory Map for local development (avoiding DB write overhead).
 * When the DB rate_limits table is available, falls back to it automatically
 * (required for correct behavior under Vercel/serverless where in-memory state
 * does not persist across invocations).
 *
 * Set RATE_LIMITER=db to force DB-backed mode (recommended on Vercel).
 */

const { getDb } = require("./database");

const buckets = new Map();
let dbTableReady = false;

async function ensureRateLimitsTable() {
  try {
    const db = getDb();
    await db.exec(
      `CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0,
        reset_at TEXT NOT NULL
      )`
    );
    dbTableReady = true;
  } catch {
    // DB not available — fall back to in-memory only.
    dbTableReady = false;
  }
}

function useDb() {
  return process.env.RATE_LIMITER === "db" || (process.env.VERCEL && process.env.RATE_LIMITER !== "memory");
}

async function assertRateLimit(key, options = {}) {
  const limit = options.limit || 5;
  const windowMs = options.windowMs || 60_000;
  const now = Date.now();
  const windowKey = `${key}:${Math.floor(now / windowMs)}`;

  if (useDb()) {
    try {
      if (!dbTableReady) await ensureRateLimitsTable();
      const db = getDb();
      const resetAt = new Date((Math.floor(now / windowMs) + 1) * windowMs).toISOString();

      await db.run(
        `INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
         ON CONFLICT(key) DO UPDATE SET count = count + 1`,
        windowKey,
        resetAt
      );

      const row = await db.get("SELECT count, reset_at FROM rate_limits WHERE key = ?", windowKey);
      const count = Number(row?.count || 0);

      if (count > limit) {
        const error = new Error("Terlalu banyak percobaan. Coba lagi beberapa saat.");
        error.status = 429;
        error.retryAfterSeconds = Math.ceil((new Date(row.reset_at).getTime() - now) / 1000);
        throw error;
      }
      return;
    } catch (err) {
      if (err.status === 429) throw err;
      // DB error: fall through to in-memory as best-effort.
      console.error("Rate limiter DB error, falling back to in-memory:", err.message);
    }
  }

  // In-memory fallback (local dev or after DB failure).
  const bucket = buckets.get(windowKey) || { count: 0, resetAt: now + windowMs };
  bucket.count += 1;
  buckets.set(windowKey, bucket);

  if (bucket.count > limit) {
    const error = new Error("Terlalu banyak percobaan. Coba lagi beberapa saat.");
    error.status = 429;
    error.retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
    throw error;
  }
}

function resetRateLimits() {
  buckets.clear();
}

// Periodic cleanup of in-memory buckets (every 5 minutes).
if (typeof setInterval === "function") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, 300_000);
}

module.exports = {
  assertRateLimit,
  resetRateLimits,
  ensureRateLimitsTable,
};