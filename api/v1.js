const { ensureDatabase } = require("../server/bootstrap");
const { getDb } = require("../server/database");
const { readJson, sendJson } = require("../server/http-utils");
const { authenticateApiKey } = require("../server/api-auth");
const { generateQuestions, evaluateAnswers, recommendAssessmentConfig } = require("../server/assessment-service");
const { assertRateLimit } = require("../server/rate-limit");

/**
 * Public REST API (v1) for external systems.
 * Authenticated via `Authorization: Bearer <api_key>`.
 *
 * Endpoints:
 *   POST /api/v1/assessments/generate   - generate questions from config
 *   POST /api/v1/assessments/evaluate   - evaluate student answers
 *   POST /api/v1/assessments/recommend  - recommend outcomes + rubric
 *   GET  /api/v1/assessments            - list assessments for the tenant
 *   GET  /api/v1/submissions            - list submissions for the tenant
 */
module.exports = async (req, res) => {
  try {
    await ensureDatabase();

    // API key authentication (Bearer token).
    const apiAuth = await authenticateApiKey(req);
    if (!apiAuth) return sendJson(res, 401, { error: "Unauthorized. Sertakan Authorization: Bearer <api_key>" });

    // Rate-limit external API calls per API key to protect token spend.
    assertRateLimit(`v1:${apiAuth.keyId}`, { limit: 60, windowMs: 60_000 });

    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname.replace(/^\/api\/v1/, "");

    // GET /assessments
    if (req.method === "GET" && path === "/assessments") {
      const db = getDb();
      const rows = await db.all(
        "SELECT id, topic, difficulty, status, created_at FROM assessments WHERE tenant_id = ? ORDER BY created_at DESC",
        apiAuth.tenantId
      );
      return sendJson(res, 200, { assessments: rows });
    }

    // GET /submissions
    if (req.method === "GET" && path === "/submissions") {
      const db = getDb();
      const rows = await db.all(
        "SELECT id, assessment_id, student_name, final_score, submitted_at FROM submissions WHERE tenant_id = ? ORDER BY submitted_at DESC",
        apiAuth.tenantId
      );
      return sendJson(res, 200, { submissions: rows });
    }

    if (req.method !== "POST") {
      return sendJson(res, 405, { error: "Method not allowed" });
    }

    const body = await readJson(req);
    const payload = body || {};

    // Attach tenant context for telemetry.
    payload.tenantId = apiAuth.tenantId;
    payload.userId = `apikey:${apiAuth.keyId}`;

    // POST /assessments/generate
    if (path === "/assessments/generate") {
      const questions = await generateQuestions(payload);
      return sendJson(res, 200, { questions });
    }

    // POST /assessments/evaluate
    if (path === "/assessments/evaluate") {
      const evaluation = await evaluateAnswers(payload);
      return sendJson(res, 200, { evaluation });
    }

    // POST /assessments/recommend
    if (path === "/assessments/recommend") {
      const recommendation = await recommendAssessmentConfig(payload);
      return sendJson(res, 200, { recommendation });
    }

    return sendJson(res, 404, { error: "Endpoint not found" });
  } catch (error) {
    console.error(error);
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};