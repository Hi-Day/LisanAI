const {
  generateProbing,
  generateQuestions,
  improveQuestionSet,
  recommendAssessmentConfig,
  streamAlignRubricSet,
  streamGenerateQuestions,
  streamImproveQuestionSet,
  streamProbing,
  streamRecommendAssessmentConfig,
} = require("../server/assessment-service");
const { evaluateAssessment, evaluateAssessmentWithProgress } = require("../server/evaluation/evaluation-service");
const { getSessionUser, SESSION_COOKIE } = require("../server/auth-service");
const { ensureDatabase } = require("../server/bootstrap");
const { parseCookies, readJson, sendJson } = require("../server/http-utils");
const { applySecurityHeaders } = require("../server/security-headers");
const { authenticateApiKey } = require("../server/api-auth");
const { assertRateLimit } = require("../server/rate-limit");

/** Write an SSE event to the response. */
function writeSse(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/** Stream an AI action to the client via Server-Sent Events. */
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
    if (text && res.writableEnded === false) writeSse(res, { type: "chunk", text });
  };

  try {
    let result;
    if (action === "generate-questions") {
      result = await streamGenerateQuestions(payload, onChunk);
      writeSse(res, { type: "result", data: { questions: result } });
    } else if (action === "align-rubric") {
      result = await streamAlignRubricSet(payload, onChunk);
      writeSse(res, { type: "result", data: { questions: result, aligned: true } });
    } else if (action === "improve-questions") {
      result = await streamImproveQuestionSet(payload, onChunk);
      writeSse(res, { type: "result", data: { questions: result } });
    } else if (action === "recommend-assessment-config") {
      result = await streamRecommendAssessmentConfig(payload, onChunk);
      writeSse(res, { type: "result", data: { recommendation: result } });
    } else if (action === "evaluate") {
      const evaluation = await evaluateAssessmentWithProgress(
        { ...payload, auth },
        (text) => {
          if (res.writableEnded === false) writeSse(res, { type: "chunk", text });
        }
      );
      writeSse(res, { type: "chunk", text: "Evaluasi selesai." });
      writeSse(res, { type: "result", data: { evaluation, harness: true } });
    } else if (action === "generate-probing") {
      const probing = await streamProbing(payload, onChunk);
      writeSse(res, { type: "result", data: { probing } });
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

    if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

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
    if (!auth) return sendJson(res, 401, { error: "Unauthorized" });

    assertRateLimit(`assessment:${auth.user.id}`, { limit: 30, windowMs: 60_000 });

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

    if (payload) {
      payload.tenantId = auth.tenant.id;
      payload.userId = auth.user.id;
    }

    if (stream === true) {
      if (action === "evaluate" && auth.user.role === "student") {
        const { assertCanSubmitAssessment } = require("../server/database");
        try {
          await assertCanSubmitAssessment(auth.tenant.id, auth.user.id, payload.assessment.id);
        } catch (authError) {
          return sendJson(res, authError.status || 403, { error: authError.message });
        }
      }
      if (action !== "evaluate" && action !== "generate-probing" && !["admin", "teacher"].includes(auth.user.role)) {
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
      const evaluation = await evaluateAssessment({ ...payload, auth });
      return sendJson(res, 200, { evaluation, model: process.env.OPENROUTER_MODEL, harness: true });
    }

    if (!["admin", "teacher"].includes(auth.user.role)) return sendJson(res, 403, { error: "Forbidden" });

    if (action === "generate-questions") {
      const questions = await generateQuestions(payload);
      return sendJson(res, 200, { questions, model: process.env.OPENROUTER_MODEL });
    }

    if (action === "align-rubric") {
      const { calibrateRubricSet } = require("../server/assessment-service");
      const questions = await calibrateRubricSet(payload);
      return sendJson(res, 200, { questions, model: process.env.OPENROUTER_MODEL, aligned: true });
    }

    if (action === "improve-questions") {
      const questions = await improveQuestionSet(payload);
      return sendJson(res, 200, { questions, model: process.env.OPENROUTER_MODEL });
    }

    if (action === "recommend-assessment-config") {
      const recommendation = await recommendAssessmentConfig(payload);
      return sendJson(res, 200, { recommendation, model: process.env.OPENROUTER_MODEL });
    }

    if (action === "generate-probing") {
      const probing = await generateProbing(payload);
      return sendJson(res, 200, { probing, model: process.env.OPENROUTER_MODEL });
    }

    return sendJson(res, 404, { error: "Action not found" });
  } catch (error) {
    console.error(error);
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};
