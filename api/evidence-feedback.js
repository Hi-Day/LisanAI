const { getDb, saveSubmission } = require("../server/database");
const { getSessionUser, SESSION_COOKIE, assertCsrfToken } = require("../server/auth-service");
const { ensureDatabase } = require("../server/bootstrap");
const { parseCookies, readJson, sendJson } = require("../server/http-utils");
const { applyEvidenceFeedbackLoop } = require("../server/evidence-feedback-loop");

module.exports = async (req, res) => {
  try {
    await ensureDatabase();
    if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });

    const auth = await getSessionUser(parseCookies(req)[SESSION_COOKIE]);
    if (!auth) return sendJson(res, 401, { error: "Unauthorized" });

    try {
      assertCsrfToken(req, auth);
    } catch (error) {
      return sendJson(res, 403, { error: error.message });
    }

    const body = await readJson(req);
    const submission = body?.submission;
    if (!submission?.id || !submission.assessmentId) {
      return sendJson(res, 400, { error: "Submission tidak valid" });
    }

    const db = getDb();
    const existing = await db.get(
      "SELECT * FROM submissions WHERE id = ? AND tenant_id = ?",
      submission.id,
      auth.tenant.id
    );
    if (!existing) return sendJson(res, 404, { error: "Submission tidak ditemukan" });

    if (auth.user.role === "student" && existing.user_id !== auth.user.id) {
      return sendJson(res, 403, { error: "Forbidden" });
    }

    if (["teacher", "admin"].includes(auth.user.role) && auth.user.role === "teacher") {
      const assessmentRow = await db.get(
        "SELECT class_id FROM assessments WHERE id = ? AND tenant_id = ?",
        existing.assessment_id,
        auth.tenant.id
      );
      if (!assessmentRow) return sendJson(res, 404, { error: "Assessment tidak ditemukan" });
      const classroom = await db.get(
        "SELECT teacher_id FROM classes WHERE id = ? AND tenant_id = ?",
        assessmentRow.class_id,
        auth.tenant.id
      );
      if (!classroom || classroom.teacher_id !== auth.user.id) {
        return sendJson(res, 403, { error: "Guru hanya boleh memproses kelas miliknya" });
      }
    }

    const assessmentRow = await db.get(
      "SELECT payload FROM assessments WHERE id = ? AND tenant_id = ?",
      existing.assessment_id,
      auth.tenant.id
    );
    if (!assessmentRow) return sendJson(res, 404, { error: "Assessment tidak ditemukan" });

    let assessment;
    try {
      assessment = JSON.parse(assessmentRow.payload || "{}");
    } catch {
      return sendJson(res, 422, { error: "Data assessment rusak" });
    }

    const enriched = applyEvidenceFeedbackLoop(submission, assessment);
    await saveSubmission(auth.tenant.id, existing.user_id, enriched, true);

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
