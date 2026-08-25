/**
 * Rate limiter — synchronous in-memory (default) with optional async DB-backed
 * persistence for serverless environments.
 *
 * In-memory is sufficient for single-process local dev. Set RATE_LIMITER=db
 * or run on Vercel (process.env.VERCEL) to use the async DB-backed limiter.
 *
 * Callers must use `await assertRateLimitDb(...)` for the DB version, or
 * `assertRateLimit(...)` (sync) for the in-memory version.
 */

const buckets = new Map();

function assertRateLimit(key, options = {}) {
  const limit = options.limit || 5;
  const windowMs = options.windowMs || 60_000;
  const now = Date.now();
  const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };

  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }

  bucket.count += 1;
  buckets.set(key, bucket);

  if (bucket.count > limit) {
    const error = new Error("Terlalu banyak percobaan. Coba lagi beberapa saat.");
    error.status = 429;
    error.retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
    throw error;
  }
}

async function assertRateLimitDb(key, options = {}) {
  const limit = options.limit || 5;
  const windowMs = options.windowMs || 60_000;
  const now = Date.now();
  const windowKey = `${key}:${Math.floor(now / windowMs)}`;

  try {
    const { getDb } = require("./database");
    const db = getDb();
    await db.exec(
      `CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0,
        reset_at TEXT NOT NULL
      )`
    );
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
  } catch (err) {
    if (err.status === 429) throw err;
    // DB error — fall through to in-memory.
    console.error("Rate limiter DB error, falling back to in-memory:", err.message);
    assertRateLimit(key, options);
  }
}

function resolveRateLimiter() {
  if (process.env.RATE_LIMITER === "db" || process.env.VERCEL) {
    return assertRateLimitDb;
  }
  return assertRateLimit;
}

function resetRateLimits() {
  buckets.clear();
}

module.exports = {
  assertRateLimit,
  assertRateLimitDb,
  resolveRateLimiter,
  resetRateLimits,
};