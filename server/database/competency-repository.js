const { getDb } = require("../database");

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
  listAssessments,
  listAssessmentsByIds,
  listStudentSubmissions,
  listTeacherSubmissions,
  listTenantSubmissions,
};
