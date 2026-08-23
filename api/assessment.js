const {
  evaluateAnswers,
  generateQuestions,
  improveQuestionSet,
  recommendAssessmentConfig,
  streamEvaluateAnswers,
  streamGenerateQuestions,
  streamImproveQuestionSet,
  streamRecommendAssessmentConfig,
} = require("../server/assessment-service");
const { getSessionUser, SESSION_COOKIE } = require("../server/auth-service");
const { ensureDatabase } = require("../server/bootstrap");
const { parseCookies, readJson, sendJson } = require("../server/http-utils");
const { applySecurityHeaders } = require("../server/security-headers");
const { authenticateApiKey } = require("../server/api-auth");
const { assertRateLimit } = require("../server/rate-limit");

/**
 * Write an SSE event to the response.
 */
function writeSse(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Stream an AI action to the client via Server-Sent Events.
 * The client receives incremental text chunks, then a final result event.
 */
async function handleStreamingAction(req, res, auth, action, payload) {
  applySecurityHeaders(res);
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 2000\n\n");

  const onChunk = (text) => {
    if (text && res.writableEnded === false) {
      writeSse(res, { type: "chunk", text });
    }
  };

  try {
    let result;
    if (action === "generate-questions") {
      result = await streamGenerateQuestions(payload, onChunk);
      writeSse(res, { type: "result", data: { questions: result } });
    } else if (action === "improve-questions") {
      result = await streamImproveQuestionSet(payload, onChunk);
      writeSse(res, { type: "result", data: { questions: result } });
    } else if (action === "recommend-assessment-config") {
      result = await streamRecommendAssessmentConfig(payload, onChunk);
      writeSse(res, { type: "result", data: { recommendation: result } });
    } else if (action === "evaluate") {
      // Harness streaming path (opt-in via env to preserve baseline).
      if (process.env.HARNESS_EVALUATION === "true" && payload) {
        const { evaluateWithHarness } = require("../server/harness/harness-evaluator");
        const combined = { ...payload, auth };
        const evaluation = await evaluateWithHarness(combined);
        writeSse(res, { type: "chunk", text: "Evaluasi selesai." });
        writeSse(res, { type: "result", data: { evaluation, harness: true } });
      } else {
        result = await streamEvaluateAnswers(payload, onChunk);
        writeSse(res, { type: "result", data: { evaluation: result } });
      }
    } else {
      writeSse(res, { type: "error", message: "Action not found" });
    }
  } catch (error) {
    console.error(error);
    writeSse(res, { type: "error", message: error.message || "Server error" });
  } finally {
    res.end();
  }
}

module.exports = async (req, res) => {
  try {
    await ensureDatabase();

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

    // Rate-limit AI actions per user/API-key to protect token spend.
    assertRateLimit(`assessment:${auth.user.id}`, { limit: 30, windowMs: 60_000 });

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
    const { action, payload, stream } = body;

    // Attach authentication context for telemetry logging
    if (payload) {
      payload.tenantId = auth.tenant.id;
      payload.userId = auth.user.id;
    }

    // Streaming path (browser UI).
    if (stream === true) {
      if (action === "evaluate" && auth.user.role === "student") {
        const { assertCanSubmitAssessment } = require("../server/database");
        try {
          await assertCanSubmitAssessment(auth.tenant.id, auth.user.id, payload.assessment.id);
        } catch (authError) {
          return sendJson(res, authError.status || 403, { error: authError.message });
        }
      }
      if (action !== "evaluate" && !["admin", "teacher"].includes(auth.user.role)) {
        return sendJson(res, 403, { error: "Forbidden" });
      }
      return handleStreamingAction(req, res, auth, action, payload);
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
      // Harness path (opt-in via env to preserve baseline).
      if (process.env.HARNESS_EVALUATION === "true") {
        const { evaluateWithHarness } = require("../server/harness/harness-evaluator");
        const harnessPayload = { ...payload, auth };
        const evaluation = await evaluateWithHarness(harnessPayload);
        return sendJson(res, 200, { evaluation, model: process.env.OPENROUTER_MODEL, harness: true });
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
