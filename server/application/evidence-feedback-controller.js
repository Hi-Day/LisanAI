const { ensureDatabase } = require("../bootstrap");
const { readJson, sendJson } = require("../http-utils");
const { requireAuthenticatedRequest, requireRoles } = require("../http/request-security");
const { processEvidenceFeedback } = require("../evidence-feedback-service");

module.exports = async (req, res) => {
  try {
    await ensureDatabase();
    if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

    const security = await requireAuthenticatedRequest(req, res, {
      rateLimit: "evidence-feedback",
      rateLimitOptions: { limit: 20, windowMs: 60_000 },
    });
    if (!security) return;
    const { auth } = security;
    if (!requireRoles(res, auth, ["admin", "teacher", "student"])) return;

    const body = await readJson(req);
    const submission = body?.submission;
    if (!submission?.id || !submission.assessmentId) {
      return sendJson(res, 400, { error: "Submission tidak valid" });
    }

    const enriched = await processEvidenceFeedback(auth, submission);
    return sendJson(res, 200, {
      ok: true,
      submission: enriched,
      competencyState: enriched.competencyState,
      evidenceFeedback: enriched.evidenceFeedback,
    });
  } catch (error) {
    console.error("[evidence-feedback]", error);
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};
