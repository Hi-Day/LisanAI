const { getDb } = require("../database");

async function listAssessments(tenantId) {
  return getDb().all("SELECT id, class_id, teacher_id, payload FROM assessments WHERE tenant_id = ?", tenantId);
}

async function listStudentSubmissions(tenantId, userId) {
  return getDb().all("SELECT * FROM submissions WHERE tenant_id = ? AND user_id = ? ORDER BY submitted_at ASC", tenantId, userId);
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
  listStudentSubmissions,
  listTeacherSubmissions,
  listTenantSubmissions,
};
