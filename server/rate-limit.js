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

function resetRateLimits() {
  buckets.clear();
}

module.exports = {
  assertRateLimit,
  resetRateLimits,
};
