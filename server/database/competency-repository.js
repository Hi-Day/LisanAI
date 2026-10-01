const { getDb } = require("../database");

async function replaceStudentCompetencyStates(tenantId, studentId, trajectory = []) {
  const db = getDb();
  await db.run("DELETE FROM student_competency_state WHERE tenant_id = ? AND student_id = ?", tenantId, studentId);
  const now = new Date().toISOString();
  for (const item of trajectory) {
    await db.run(
      `INSERT INTO student_competency_state
       (tenant_id, student_id, learning_outcome_id, learning_outcome, latest_score, latest_submitted_at, snapshot_count, history, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      tenantId,
      studentId,
      item.learningOutcomeId,
      item.learningOutcome,
      item.latest?.score ?? 0,
      item.latest?.submittedAt ?? null,
      item.snapshotCount || item.history?.length || 0,
      JSON.stringify(item.history || []),
      now,
    );
  }
}

async function listStudentCompetencyStates(tenantId, studentId) {
  return getDb().all(
    "SELECT * FROM student_competency_state WHERE tenant_id = ? AND student_id = ? ORDER BY learning_outcome_id, learning_outcome",
    tenantId,
    studentId,
  );
}

async function listAssessments(tenantId) {
  return getDb().all("SELECT id, class_id, teacher_id, payload FROM assessments WHERE tenant_id = ?", tenantId);
}

async function listStudentSubmissions(tenantId, userId, limit = 300) {
  const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 300));
  const rows = await getDb().all(
    "SELECT * FROM submissions WHERE tenant_id = ? AND user_id = ? ORDER BY submitted_at DESC LIMIT ?",
    tenantId,
    userId,
    safeLimit,
  );
  return rows.reverse();
}

async function listAssessmentsByIds(tenantId, assessmentIds = []) {
  const ids = [...new Set(assessmentIds.map(String).filter(Boolean))];
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  return getDb().all(
    `SELECT id, class_id, teacher_id, payload FROM assessments WHERE tenant_id = ? AND id IN (${placeholders})`,
    tenantId,
    ...ids,
  );
}

async function listTeacherSubmissions(tenantId, teacherId) {
  return getDb().all(`SELECT s.* FROM submissions s JOIN assessments a ON a.id = s.assessment_id
    WHERE s.tenant_id = ? AND a.tenant_id = ? AND a.teacher_id = ? ORDER BY s.submitted_at ASC`, tenantId, tenantId, teacherId);
}

async function listTenantSubmissions(tenantId) {
  return getDb().all("SELECT * FROM submissions WHERE tenant_id = ? ORDER BY submitted_at ASC", tenantId);
}

module.exports = {
  replaceStudentCompetencyStates,
  listStudentCompetencyStates,
  listAssessments,
  listAssessmentsByIds,
  listStudentSubmissions,
  listTeacherSubmissions,
  listTenantSubmissions,
};
