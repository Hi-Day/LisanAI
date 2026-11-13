const { getDb } = require("./database");

/** Delete rows that only matter for a short time, so these tables do not grow forever. */
async function purgeExpiredRows(now = new Date()) {
  const db = getDb();
  const nowIso = now.toISOString();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  await db.run("DELETE FROM sessions WHERE expires_at <= ?", nowIso);
  await db.run("DELETE FROM rate_limits WHERE reset_at <= ?", nowIso);
  // Nonces only guard the 5-minute OAuth clock-skew window; a day is a wide margin.
  await db.run("DELETE FROM lti_nonces WHERE created_at <= ?", dayAgo);
}

module.exports = { purgeExpiredRows };
