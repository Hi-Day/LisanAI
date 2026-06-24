const {
  evaluateAnswers,
  generateQuestions,
  improveQuestionSet,
  recommendAssessmentConfig,
} = require("../server/assessment-service");
const { getSessionUser, SESSION_COOKIE } = require("../server/auth-service");
const { initDatabase } = require("../server/database");
const { parseCookies, readJson, sendJson } = require("../server/http-utils");

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

    const auth = await getSessionUser(parseCookies(req)[SESSION_COOKIE]);
    if (!auth) return sendJson(res, 401, { error: "Unauthorized" });

    // CSRF Check
    const { assertCsrfToken } = require("../server/auth-service");
    try {
      assertCsrfToken(req, auth);
    } catch (csrfError) {
      return sendJson(res, 403, { error: csrfError.message });
    }

    const body = await readJson(req);
    const { action, payload } = body;

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
