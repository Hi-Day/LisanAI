const { ensureDatabase } = require("../server/bootstrap");
const { getDb } = require("../server/database");
const { readJson, sendJson } = require("../server/http-utils");
const { authenticateApiKey } = require("../server/api-auth");
const { generateQuestions, recommendAssessmentConfig } = require("../server/assessment-service");
const { assertRateLimit } = require("../server/rate-limit");

module.exports = async (req, res) => {
  const pathname = req.url ? req.url.split("?")[0] : "";
  if (pathname === "/api/docs" || pathname === "/api/docs/" || pathname === "/api/docs/spec" || pathname === "/api/docs/spec.json") {
    return require("../api-internal/docs")(req, res);
  }
  try {
    await ensureDatabase();
    const apiAuth = await authenticateApiKey(req);
    if (!apiAuth) return sendJson(res, 401, { error: "Unauthorized. Sertakan Authorization: Bearer <api_key>" });
    assertRateLimit(`v1:${apiAuth.keyId}`, { limit: 60, windowMs: 60_000 });
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname.replace(/^\/api\/v1/, "");
    if (req.method === "GET" && path === "/assessments") {
      const rows = await getDb().all("SELECT id, topic, difficulty, status, created_at FROM assessments WHERE tenant_id = ? ORDER BY created_at DESC", apiAuth.tenantId);
      return sendJson(res, 200, { assessments: rows });
    }
    if (req.method === "GET" && path === "/submissions") {
      const rows = await getDb().all("SELECT id, assessment_id, student_name, final_score, submitted_at FROM submissions WHERE tenant_id = ? ORDER BY submitted_at DESC", apiAuth.tenantId);
      return sendJson(res, 200, { submissions: rows });
    }
    if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
    const payload = await readJson(req);
    payload.tenantId = apiAuth.tenantId;
    payload.userId = `apikey:${apiAuth.keyId}`;
    if (path === "/assessments/generate") {
      if (!payload.topic || typeof payload.topic !== "string") return sendJson(res, 400, { error: "Topik wajib diisi" });
      return sendJson(res, 200, { questions: await generateQuestions(payload) });
    }
    if (path === "/assessments/evaluate") {
      if (!Array.isArray(payload.answers) || payload.answers.length === 0) return sendJson(res, 400, { error: "Jawaban siswa wajib diisi" });
      const { evaluateWithHarness } = require("../server/harness/harness-evaluator");
      return sendJson(res, 200, { evaluation: await evaluateWithHarness(payload) });
    }
    if (path === "/assessments/recommend") {
      if (!payload.topic || typeof payload.topic !== "string") return sendJson(res, 400, { error: "Topik wajib diisi" });
      return sendJson(res, 200, { recommendation: await recommendAssessmentConfig(payload) });
    }
    return sendJson(res, 404, { error: "Endpoint not found" });
  } catch (error) {
    console.error(error);
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};
