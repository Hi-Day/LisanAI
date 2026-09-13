function writableError(message, status) { return Object.assign(new Error(message), { status }); }

async function getWritableAssessment(db, auth, assessmentId) {
  const assessment = await db.get("SELECT * FROM assessments WHERE id = ? AND tenant_id = ?", assessmentId, auth.tenant.id);
  if (!assessment) throw writableError("Assessment tidak ditemukan", 404);
  if (auth.user.role === "teacher" && assessment.teacher_id !== auth.user.id) throw writableError("Guru hanya boleh mengubah assessment miliknya", 403);
  return assessment;
}

async function assertCanWriteAssessment(db, auth, assessment) {
  if (!assessment.classId) throw writableError("Assessment wajib punya kelas tujuan", 400);
  const classroom = await db.get("SELECT id, teacher_id FROM classes WHERE id = ? AND tenant_id = ?", assessment.classId, auth.tenant.id);
  if (!classroom) throw writableError("Kelas tidak ditemukan", 404);
  if (auth.user.role === "teacher" && classroom.teacher_id !== auth.user.id) throw writableError("Guru hanya boleh membuat assessment untuk kelasnya sendiri", 403);
}

async function saveAssessment(db, auth, assessment) {
  await assertCanWriteAssessment(db, auth, assessment);
  await db.run(`INSERT OR REPLACE INTO assessments (id, tenant_id, class_id, teacher_id, status, topic, difficulty, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, assessment.id, auth.tenant.id, assessment.classId, auth.user.id,
    assessment.status || "published", assessment.topic, assessment.difficulty, JSON.stringify(assessment), assessment.createdAt);
  return assessment;
}

async function updateAssessment(db, auth, assessmentId, patch) {
  const existing = await getWritableAssessment(db, auth, assessmentId);
  const payload = JSON.parse(existing.payload);
  const next = { ...payload, ...patch, id: payload.id, classId: patch.classId || payload.classId || existing.class_id, updatedAt: new Date().toISOString() };
  await assertCanWriteAssessment(db, auth, next);
  await db.run(`UPDATE assessments SET class_id = ?, status = ?, topic = ?, difficulty = ?, payload = ? WHERE id = ? AND tenant_id = ?`,
    next.classId, next.status || "published", next.topic, next.difficulty, JSON.stringify(next), assessmentId, auth.tenant.id);
  return next;
}

async function deleteAssessment(db, auth, assessmentId) {
  await getWritableAssessment(db, auth, assessmentId);
  await db.run("DELETE FROM assessments WHERE id = ? AND tenant_id = ?", assessmentId, auth.tenant.id);
}

async function getVisibleAssessments(db, auth) {
  if (auth.user.role === "student") return db.all(`SELECT assessments.payload FROM assessments
       JOIN class_memberships ON class_memberships.class_id = assessments.class_id
       WHERE assessments.tenant_id = ? AND class_memberships.student_id = ? AND class_memberships.status = 'approved'
         AND COALESCE(assessments.status, 'published') = 'published' ORDER BY assessments.created_at DESC`, auth.tenant.id, auth.user.id);
  if (auth.user.role === "teacher") return db.all("SELECT payload FROM assessments WHERE tenant_id = ? AND teacher_id = ? ORDER BY created_at DESC", auth.tenant.id, auth.user.id);
  return db.all("SELECT payload FROM assessments WHERE tenant_id = ? ORDER BY created_at DESC", auth.tenant.id);
}

function sanitizeAssessmentForRole(assessment, isStudentView) {
  if (!isStudentView || !Array.isArray(assessment.questions)) return assessment;
  return { ...assessment, questions: assessment.questions.map((question) => { const { ideal, ...rest } = question || {}; return rest; }) };
}

module.exports = { saveAssessment, updateAssessment, deleteAssessment, getVisibleAssessments, getWritableAssessment, assertCanWriteAssessment, sanitizeAssessmentForRole };
