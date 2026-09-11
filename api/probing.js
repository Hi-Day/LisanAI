const { ensureDatabase } = require("../server/bootstrap");
const { getSessionUser, SESSION_COOKIE, assertCsrfToken } = require("../server/auth-service");
const { parseCookies, readJson, sendJson } = require("../server/http-utils");
const { createProbe, getProbeForStudent, listPendingForTeacher, decideProbe } = require("../server/probing-gate");

module.exports = async (req, res) => {
  try {
    await ensureDatabase();
    const auth = await getSessionUser(parseCookies(req)[SESSION_COOKIE]);
    if (!auth) return sendJson(res, 401, { error: "Unauthorized" });

    const url = new URL(req.url, `http://${req.headers.host}`);
    const action = url.searchParams.get("action");

    if (req.method === "GET") {
      if (action === "pending") {
        return sendJson(res, 200, { probes: await listPendingForTeacher(auth) });
      }
      if (action === "status") {
        const id = url.searchParams.get("id");
        if (!id) return sendJson(res, 400, { error: "Parameter id wajib" });
        return sendJson(res, 200, { probe: await getProbeForStudent(auth, id) });
      }
      return sendJson(res, 404, { error: "Action not found" });
    }

    if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
    try { assertCsrfToken(req, auth); } catch (error) { return sendJson(res, 403, { error: error.message }); }
    const body = await readJson(req);

    if (body.action === "create") {
      return sendJson(res, 201, { probe: await createProbe(auth, body.payload || {}) });
    }
    if (body.action === "decide") {
      const payload = body.payload || {};
      return sendJson(res, 200, {
        probe: await decideProbe(auth, payload.id, payload.decision, payload.editedPrompt, payload.note),
      });
    }
    return sendJson(res, 404, { error: "Action not found" });
  } catch (error) {
    console.error("[probing]", error);
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};
