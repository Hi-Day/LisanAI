const {
  evaluateAnswers,
  generateQuestions,
  improveQuestionSet,
  recommendAssessmentConfig,
} = require("../server/assessment-service");
const { getSessionUser, SESSION_COOKIE } = require("../server/auth-service");
const { initDatabase } = require("../server/database");
const { parseCookies, readJson, sendJson } = require("../server/http-utils");
const { authenticateApiKey } = require("../server/api-auth");

let isDbInitialized = false;

module.exports = async (req, res) => {
  try {
    if (!isDbInitialized) {
      await initDatabase();
      isDbInitialized = true;
    }

    if (req.method !== "POST") {
      return sendJson(res, 405, { error: "Method not allowed" });
    }

    // Authenticate via session cookie OR API key (Bearer token).
    let auth = await getSessionUser(parseCookies(req)[SESSION_COOKIE]);
    let viaApiKey = false;
    if (!auth) {
      const apiAuth = await authenticateApiKey(req);
      if (apiAuth) {
        // API keys act as a tenant-level admin for AI actions.
        auth = {
          tenant: { id: apiAuth.tenantId, name: "API", plan: "api" },
          user: { id: `apikey:${apiAuth.keyId}`, tenantId: apiAuth.tenantId, name: "API Key", role: "admin" },
        };
        viaApiKey = true;
      }
    }
    if (!auth) return sendJson(res, 401, { error: "Unauthorized" });

    // CSRF is only required for browser (session) auth, not API keys.
    if (!viaApiKey) {
      const { assertCsrfToken } = require("../server/auth-service");
      try {
        assertCsrfToken(req, auth);
      } catch (csrfError) {
        return sendJson(res, 403, { error: csrfError.message });
      }
    }

    const body = await readJson(req);
    const { action, payload } = body;

    // Attach authentication context for telemetry logging
    if (payload) {
      payload.tenantId = auth.tenant.id;
      payload.userId = auth.user.id;
    }

    if (action === "evaluate") {
      if (auth.user.role === "student") {
        const { assertCanSubmitAssessment } = require("../server/database");
        try {
          await assertCanSubmitAssessment(auth.tenant.id, auth.user.id, payload.assessment.id);
        } catch (authError) {
          return sendJson(res, authError.status || 403, { error: authError.message });
        }
      }
      const evaluation = await evaluateAnswers(payload);
      return sendJson(res, 200, { evaluation, model: process.env.OPENROUTER_MODEL });
    }

    // Role check for teacher/admin actions
    if (!["admin", "teacher"].includes(auth.user.role)) {
      return sendJson(res, 403, { error: "Forbidden" });
    }

    if (action === "generate-questions") {
      const questions = await generateQuestions(payload);
      return sendJson(res, 200, { questions, model: process.env.OPENROUTER_MODEL });
    }

    if (action === "improve-questions") {
      const questions = await improveQuestionSet(payload);
      return sendJson(res, 200, { questions, model: process.env.OPENROUTER_MODEL });
    }

    if (action === "recommend-assessment-config") {
      const recommendation = await recommendAssessmentConfig(payload);
      return sendJson(res, 200, { recommendation, model: process.env.OPENROUTER_MODEL });
    }

    return sendJson(res, 404, { error: "Action not found" });
  } catch (error) {
    console.error(error);
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};
