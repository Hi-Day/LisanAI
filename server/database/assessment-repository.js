const { validateAssessmentIntegrity } = require("../assessment-integrity");
const { assessmentSnapshotHash } = require("../security/assessment-integrity");

function writableError(message, status) { return Object.assign(new Error(message), { status }); }

function normalizeClassIds(assessment) {
  const raw = Array.isArray(assessment?.classIds)
    ? assessment.classIds
    : (assessment?.classId ? [assessment.classId] : []);
  return [...new Set(raw.map((id) => String(id || "").trim()).filter(Boolean))];
}

async function getWritableAssessment(db, auth, assessmentId) {
  const assessment = await db.get("SELECT * FROM assessments WHERE id = ? AND tenant_id = ?", assessmentId, auth.tenant.id);
  if (!assessment) throw writableError("Assessment tidak ditemukan", 404);
  if (auth.user.role === "teacher" && assessment.teacher_id !== auth.user.id) throw writableError("Guru hanya boleh mengubah assessment miliknya", 403);
  return assessment;
}

async function assertCanWriteAssessment(db, auth, assessment) {
  const classIds = normalizeClassIds(assessment);
  if (!classIds.length) throw writableError("Assessment wajib punya minimal satu kelas tujuan", 400);

  const placeholders = classIds.map(() => "?").join(",");
  const classes = await db.all(
    `SELECT id, teacher_id FROM classes WHERE tenant_id = ? AND id IN (${placeholders})`,
    auth.tenant.id,
    ...classIds,
  );
  if (classes.length !== classIds.length) throw writableError("Salah satu kelas tujuan tidak ditemukan", 404);
  if (auth.user.role === "teacher" && classes.some((classroom) => classroom.teacher_id !== auth.user.id)) {
    throw writableError("Guru hanya boleh menerbitkan assessment ke kelas miliknya", 403);
  }
  return classIds;
}

async function syncAssessmentClasses(db, tenantId, assessmentId, classIds, status, assignedAt) {
  await db.run("DELETE FROM assessment_classes WHERE tenant_id = ? AND assessment_id = ?", tenantId, assessmentId);
  for (const classId of classIds) {
    await db.run(
      `INSERT INTO assessment_classes (tenant_id, assessment_id, class_id, status, assigned_at)
       VALUES (?, ?, ?, ?, ?)`,
      tenantId, assessmentId, classId, status || "published", assignedAt || new Date().toISOString(),
    );
  }
}

// Edits that change what is scored are refused while students are mid-exam: their
// attempt is bound to the assessment hash and could no longer be submitted.
async function assertNoActiveAttempts(db, tenantId, assessmentId, before, after) {
  if (assessmentSnapshotHash(before) === assessmentSnapshotHash(after)) return;
  const now = Date.now();
  const active = await db.get(
    `SELECT id FROM assessment_attempts
      WHERE tenant_id = ? AND assessment_id = ? AND status IN ('STARTED','SUBMITTING')
        AND ((deadline_at IS NOT NULL AND deadline_at > ?) OR (deadline_at IS NULL AND started_at > ?))
      LIMIT 1`,
    tenantId, assessmentId, new Date(now).toISOString(), new Date(now - 24 * 60 * 60 * 1000).toISOString(),
  );
  if (active) {
    throw Object.assign(
      new Error("Soal atau rubrik tidak dapat diubah selama ada mahasiswa yang sedang mengerjakan. Coba lagi setelah ujian selesai."),
      { status: 409, code: "ASSESSMENT_IN_PROGRESS" },
    );
  }
}

async function enrichAssessments(db, auth, rows) {
  const payloads = rows.map((row) => JSON.parse(row.payload));
  if (!payloads.length) return [];
  // One query for all assessments instead of one per assessment.
  const placeholders = payloads.map(() => "?").join(",");
  const ids = payloads.map((payload) => payload.id);
  const allAssignments = auth.user.role === "student"
    ? await db.all(
      `SELECT ac.assessment_id, ac.class_id, ac.status, ac.assigned_at, c.name, c.join_code
       FROM assessment_classes ac
       JOIN class_memberships cm ON cm.class_id = ac.class_id
         AND cm.tenant_id = ac.tenant_id AND cm.student_id = ? AND cm.status = 'approved'
       JOIN classes c ON c.id = ac.class_id AND c.tenant_id = ac.tenant_id
       WHERE ac.tenant_id = ? AND ac.assessment_id IN (${placeholders})
       ORDER BY c.name`,
      auth.user.id, auth.tenant.id, ...ids,
    )
    : await db.all(
      `SELECT ac.assessment_id, ac.class_id, ac.status, ac.assigned_at, c.name, c.join_code
       FROM assessment_classes ac
       JOIN classes c ON c.id = ac.class_id AND c.tenant_id = ac.tenant_id
       WHERE ac.tenant_id = ? AND ac.assessment_id IN (${placeholders})
       ORDER BY c.name`,
      auth.tenant.id, ...ids,
    );
  const byAssessment = new Map();
  for (const item of allAssignments) {
    if (!byAssessment.has(item.assessment_id)) byAssessment.set(item.assessment_id, []);
    byAssessment.get(item.assessment_id).push(item);
  }

  const assessments = [];
  for (const payload of payloads) {
    const assignments = byAssessment.get(payload.id) || [];

    if (!assignments.length && auth.user.role === "student") continue;

    payload.classIds = assignments.map((item) => item.class_id);
    payload.classAssignments = assignments.map((item) => ({
      classId: item.class_id,
      className: item.name,
      classCode: item.join_code,
      status: item.status,
      assignedAt: item.assigned_at,
    }));
    payload.classCodes = payload.classAssignments.map((item) => item.classCode).filter(Boolean);
    payload.classId = payload.classId || payload.classIds[0] || "";
    payload.availableClassIds = payload.classIds;
    assessments.push({ payload: JSON.stringify(payload) });
  }
  return assessments;
}

async function saveAssessment(db, auth, assessment) {
  const classIds = await assertCanWriteAssessment(db, auth, assessment);
  validateAssessmentIntegrity(assessment);
  const primaryClassId = classIds[0];
  const payload = { ...assessment, classId: primaryClassId, classIds };
  // Not INSERT OR REPLACE: REPLACE deletes the old row and the ON DELETE CASCADE
  // foreign keys then delete every submission and attempt of that assessment.
  const existing = await db.get("SELECT tenant_id, teacher_id, payload FROM assessments WHERE id = ?", payload.id);
  if (existing) {
    if (existing.tenant_id !== auth.tenant.id) throw writableError("ID assessment sudah dipakai", 409);
    if (auth.user.role === "teacher" && existing.teacher_id !== auth.user.id) throw writableError("Guru hanya boleh mengubah assessment miliknya", 403);
    await assertNoActiveAttempts(db, auth.tenant.id, payload.id, JSON.parse(existing.payload || "{}"), payload);
    await db.run(`UPDATE assessments SET class_id = ?, status = ?, topic = ?, difficulty = ?, payload = ? WHERE id = ? AND tenant_id = ?`,
      primaryClassId, payload.status || "published", payload.topic, payload.difficulty, JSON.stringify(payload), payload.id, auth.tenant.id);
  } else {
    await db.run(`INSERT INTO assessments (id, tenant_id, class_id, teacher_id, status, topic, difficulty, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, payload.id, auth.tenant.id, primaryClassId, auth.user.id,
      payload.status || "published", payload.topic, payload.difficulty, JSON.stringify(payload), payload.createdAt);
  }
  await syncAssessmentClasses(db, auth.tenant.id, payload.id, classIds, payload.status || "published", payload.createdAt);
  return payload;
}

async function updateAssessment(db, auth, assessmentId, patch) {
  const existing = await getWritableAssessment(db, auth, assessmentId);
  const payload = JSON.parse(existing.payload);
  const requestedClassIds = patch?.classIds || (patch?.classId ? [patch.classId] : null);
  const next = {
    ...payload,
    ...patch,
    id: payload.id,
    classId: requestedClassIds ? requestedClassIds[0] : (payload.classId || existing.class_id),
    classIds: requestedClassIds ? [...new Set(requestedClassIds.filter(Boolean))] : normalizeClassIds(payload),
    updatedAt: new Date().toISOString(),
  };
  await assertCanWriteAssessment(db, auth, next);
  validateAssessmentIntegrity(next);
  await assertNoActiveAttempts(db, auth.tenant.id, assessmentId, payload, next);
  await db.run(`UPDATE assessments SET class_id = ?, status = ?, topic = ?, difficulty = ?, payload = ? WHERE id = ? AND tenant_id = ?`,
    next.classId, next.status || "published", next.topic, next.difficulty, JSON.stringify(next), assessmentId, auth.tenant.id);
  await syncAssessmentClasses(db, auth.tenant.id, assessmentId, next.classIds, next.status || "published", payload.createdAt || new Date().toISOString());
  return next;
}

async function deleteAssessment(db, auth, assessmentId) {
  await getWritableAssessment(db, auth, assessmentId);
  await db.run("DELETE FROM assessment_classes WHERE assessment_id = ? AND tenant_id = ?", assessmentId, auth.tenant.id);
  await db.run("DELETE FROM assessments WHERE id = ? AND tenant_id = ?", assessmentId, auth.tenant.id);
}

async function getVisibleAssessments(db, auth) {
  let rows;
  if (auth.user.role === "student") {
    rows = await db.all(
      `SELECT DISTINCT a.payload
       FROM assessments a
       JOIN assessment_classes ac ON ac.assessment_id = a.id AND ac.tenant_id = a.tenant_id
       JOIN class_memberships cm ON cm.class_id = ac.class_id AND cm.tenant_id = ac.tenant_id
       WHERE a.tenant_id = ? AND cm.student_id = ? AND cm.status = 'approved'
         AND ac.status = 'published' AND COALESCE(a.status, 'published') = 'published'
       ORDER BY a.created_at DESC`,
      auth.tenant.id, auth.user.id,
    );
  } else if (auth.user.role === "teacher") {
    rows = await db.all("SELECT payload FROM assessments WHERE tenant_id = ? AND teacher_id = ? ORDER BY created_at DESC", auth.tenant.id, auth.user.id);
  } else {
    rows = await db.all("SELECT payload FROM assessments WHERE tenant_id = ? ORDER BY created_at DESC", auth.tenant.id);
  }
  return enrichAssessments(db, auth, rows);
}

function sanitizeAssessmentForRole(assessment, isStudentView) {
  if (!isStudentView || !Array.isArray(assessment.questions)) return assessment;
  return { ...assessment, questions: assessment.questions.map((question) => { const { ideal, ...rest } = question || {}; return rest; }) };
}

module.exports = {
  saveAssessment, updateAssessment, deleteAssessment, getVisibleAssessments,
  getWritableAssessment, assertCanWriteAssessment, sanitizeAssessmentForRole,
  validateAssessmentIntegrity, normalizeClassIds,
};