const { getSessionUser, SESSION_COOKIE } = require("../server/auth-service");
const { parseCookies, sendJson } = require("../server/http-utils");
const { ensureDatabase } = require("../server/bootstrap");
const competencyService = require("../server/application/competency-service");

module.exports = async (req, res) => {
  try {
    await ensureDatabase();
    if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
    const auth = await getSessionUser(parseCookies(req)[SESSION_COOKIE]);
    if (!auth) return sendJson(res, 401, { error: "Unauthorized" });
    return sendJson(res, 200, { trajectory: await competencyService.execute(auth) });
  } catch (error) {
    console.error("[competency-trajectory]", error);
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};
