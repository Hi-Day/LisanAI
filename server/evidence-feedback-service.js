const { getDb, saveSubmission } = require("./database");
const { applyEvidenceFeedbackLoop } = require("./evidence-feedback-loop");

async function processEvidenceFeedback(auth, submission) {
  const db = getDb();
  const existing = await db.get(
    "SELECT * FROM submissions WHERE id = ? AND tenant_id = ?",
    submission.id,
    auth.tenant.id
  );
  if (!existing) throw Object.assign(new Error("Submission tidak ditemukan"), { status: 404 });

  if (auth.user.role === "student" && existing.user_id !== auth.user.id) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  if (auth.user.role === "teacher") {
    const assessmentRow = await db.get(
      "SELECT class_id FROM assessments WHERE id = ? AND tenant_id = ?",
      existing.assessment_id,
      auth.tenant.id
    );
    if (!assessmentRow) throw Object.assign(new Error("Assessment tidak ditemukan"), { status: 404 });
    const classroom = await db.get(
      "SELECT teacher_id FROM classes WHERE id = ? AND tenant_id = ?",
      assessmentRow.class_id,
      auth.tenant.id
    );
    if (!classroom || classroom.teacher_id !== auth.user.id) {
      throw Object.assign(new Error("Guru hanya boleh memproses kelas miliknya"), { status: 403 });
    }
  }

  const assessmentRow = await db.get(
    "SELECT payload FROM assessments WHERE id = ? AND tenant_id = ?",
    existing.assessment_id,
    auth.tenant.id
  );
  if (!assessmentRow) throw Object.assign(new Error("Assessment tidak ditemukan"), { status: 404 });

  let assessment;
  try {
    assessment = JSON.parse(assessmentRow.payload || "{}");
  } catch {
    throw Object.assign(new Error("Data assessment rusak"), { status: 422 });
  }

  const enriched = applyEvidenceFeedbackLoop(submission, assessment);
  await saveSubmission(auth.tenant.id, existing.user_id, enriched, true);
  return enriched;
}

module.exports = { processEvidenceFeedback };
