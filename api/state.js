const { getState } = require("../server/database");
const { ensureDatabase } = require("../server/bootstrap");
const { getSessionUser, SESSION_COOKIE } = require("../server/auth-service");
const { parseCookies, sendJson } = require("../server/http-utils");

/**
 * Lightweight authenticated state endpoint.
 *
 * Keep showcase provisioning out of the normal application state path. A
 * showcase seed is a deployment/bootstrap concern; running it for every
 * authenticated tenant can make a serverless request exceed its timeout.
 *
 * /api/health is intentionally handled by this same serverless function to
 * stay within Vercel Hobby's per-deployment function limit.
 */
module.exports = async (req, res) => {
  if (req.url && req.url.split("?")[0] === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      service: "lisan-ai",
      runtime: "vercel",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    await ensureDatabase();
    const auth = await getSessionUser(parseCookies(req)[SESSION_COOKIE]);
    if (!auth) return sendJson(res, 401, { error: "Unauthorized" });
    if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });

    return sendJson(res, 200, await getState(auth));
  } catch (error) {
    console.error("State endpoint error:", error);
    return sendJson(res, error.status || 500, {
      error: error.message || "Gagal memuat state aplikasi",
    });
  }
};
