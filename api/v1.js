const { ensureDatabase } = require("../server/bootstrap");
const { getDb } = require("../server/database");
const { readJson, sendJson } = require("../server/http-utils");
const { authenticateApiKey } = require("../server/api-auth");
const { generateQuestions, evaluateAnswers, recommendAssessmentConfig } = require("../server/assessment-service");
const { assertRateLimit } = require("../server/rate-limit");

/**
 * Validate that required fields are present and of correct type.
 * Returns null on success, or a 400 error response object on failure.
 */
function validateRequired(payload, fields) {
  for (const { name, type, label } of fields) {
    const value = payload[name];
    if (value == null || value === "") {
      return { error: `${label || name} wajib diisi` };
    }
    if (type === "string" && typeof value !== "string") {
      return { error: `${label || name} harus berupa teks` };
    }
    if (type === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
      return { error: `${label || name} harus berupa angka` };
    }
    if (type === "array" && !Array.isArray(value)) {
      return { error: `${label || name} harus berupa array` };
    }
    if (type === "array" && Array.isArray(value) && value.length === 0) {
      return { error: `${label || name} tidak boleh kosong` };
    }
  }
  return null;
}

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
      const err = validateRequired(payload, [
        { name: "topic", type: "string", label: "Topik" },
      ]);
      if (err) return sendJson(res, 400, { error: err.error });
      const questions = await generateQuestions(payload);
      return sendJson(res, 200, { questions });
    }

    // POST /assessments/evaluate
    if (path === "/assessments/evaluate") {
      const err = validateRequired(payload, [
        { name: "answers", type: "array", label: "Jawaban siswa" },
      ]);
      if (err) return sendJson(res, 400, { error: err.error });
      const evaluation = await evaluateAnswers(payload);
      return sendJson(res, 200, { evaluation });
    }

    // POST /assessments/recommend
    if (path === "/assessments/recommend") {
      const err = validateRequired(payload, [
        { name: "topic", type: "string", label: "Topik" },
      ]);
      if (err) return sendJson(res, 400, { error: err.error });
      const recommendation = await recommendAssessmentConfig(payload);
      return sendJson(res, 200, { recommendation });
    }

    return sendJson(res, 404, { error: "Endpoint not found" });
  } catch (error) {
    console.error(error);
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};