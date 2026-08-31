const { getSessionUser, SESSION_COOKIE, assertCsrfToken } = require("../server/auth-service");
const { ensureDatabase } = require("../server/bootstrap");
const { parseCookies, readJson, sendJson } = require("../server/http-utils");
const { authenticateApiKey } = require("../server/api-auth");
const { assertRateLimit } = require("../server/rate-limit");
const { enqueueEvaluation, getEvaluationJob } = require("../server/evaluation/evaluation-job-service");

async function authenticate(req) {
  let auth = await getSessionUser(parseCookies(req)[SESSION_COOKIE]);
  let viaApiKey = false;
  if (!auth) {
    const apiAuth = await authenticateApiKey(req);
    if (apiAuth) {
      auth = {
        tenant: { id: apiAuth.tenantId, name: "API", plan: "api" },
        user: { id: `apikey:${apiAuth.keyId}`, tenantId: apiAuth.tenantId, name: "API Key", role: "admin" },
      };
      viaApiKey = true;
    }
  }
  if (!auth) return null;
  assertRateLimit(`evaluation-job:${auth.user.id}`, { limit: 30, windowMs: 60_000 });
  if (!viaApiKey) assertCsrfToken(req, auth);
  return auth;
}

module.exports = async (req, res) => {
  try {
    await ensureDatabase();
    const auth = await authenticate(req);
    if (!auth) return sendJson(res, 401, { error: "Unauthorized" });

    if (req.method === "POST") {
      const body = await readJson(req);
      const payload = body.payload || {};
      payload.tenantId = auth.tenant.id;
      payload.userId = auth.user.id;

      if (!Array.isArray(payload.answers)) return sendJson(res, 400, { error: "answers array wajib ada" });
      if (auth.user.role === "student") {
        const { assertCanSubmitAssessment } = require("../server/database");
        try {
          await assertCanSubmitAssessment(auth.tenant.id, auth.user.id, payload.assessment.id);
        } catch (error) {
          return sendJson(res, error.status || 403, { error: error.message });
        }
      }

      const job = await enqueueEvaluation(payload);
      return sendJson(res, 202, { job });
    }

    if (req.method === "GET") {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const jobId = url.searchParams.get("jobId");
      if (!jobId) return sendJson(res, 400, { error: "jobId wajib ada" });
      const job = await getEvaluationJob(jobId, auth.tenant.id);
      if (!job) return sendJson(res, 404, { error: "Evaluation job not found" });
      return sendJson(res, 200, { job });
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};
