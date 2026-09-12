async function assertCanSubmitAssessment(db, tenantId, userId, assessmentId) {
  const assessment = await db.get("SELECT id, class_id, status, payload FROM assessments WHERE id = ? AND tenant_id = ?", assessmentId, tenantId);
  if (!assessment) return;
  if (assessment.status !== "published") throw Object.assign(new Error("Assessment belum tersedia untuk dikerjakan"), { status: 403 });
  const membership = await db.get(`SELECT id FROM class_memberships WHERE tenant_id = ? AND class_id = ? AND student_id = ? AND status = 'approved'`, tenantId, assessment.class_id, userId);
  if (!membership) throw Object.assign(new Error("Siswa belum disetujui di kelas assessment ini"), { status: 403 });
  const payload = JSON.parse(assessment.payload);
  if (payload.allowRetakes === true) return;
  const maxAttempts = Math.max(1, Number(payload.maxAttempts) || 1);
  const existing = await db.get("SELECT COUNT(*) AS cnt FROM submissions WHERE tenant_id = ? AND assessment_id = ? AND user_id = ?", tenantId, assessmentId, userId);
  if (Number(existing?.cnt || 0) >= maxAttempts) throw Object.assign(new Error(`Batas percobaan tercapai (${maxAttempts} dari ${maxAttempts})`), { status: 409 });
}

async function saveSubmission(db, tenantId, userId, submission, bypassCheck = false) {
  if (userId && !bypassCheck) await assertCanSubmitAssessment(db, tenantId, userId, submission.assessmentId);
  const insert = (assessmentId) => db.run(`INSERT OR REPLACE INTO submissions (id, tenant_id, assessment_id, student_name, user_id, final_score, payload, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, submission.id, tenantId, assessmentId, submission.studentName, userId, submission.finalScore, JSON.stringify(submission), submission.submittedAt);
  try { await insert(submission.assessmentId); }
  catch (err) {
    const msg = String(err.message || err);
    if (msg.includes("FOREIGN KEY constraint failed") || msg.includes("SQLITE_CONSTRAINT_FOREIGNKEY")) await insert(null);
    else throw err;
  }
  return submission;
}

async function getVisibleSubmissions(db, auth) {
  if (auth.user.role === "student") return db.all("SELECT payload FROM submissions WHERE tenant_id = ? AND user_id = ? ORDER BY submitted_at ASC", auth.tenant.id, auth.user.id);
  if (auth.user.role === "teacher") return db.all(`SELECT s.payload FROM submissions s JOIN assessments a ON a.id = s.assessment_id
       WHERE s.tenant_id = ? AND a.tenant_id = ? AND a.teacher_id = ? ORDER BY s.submitted_at ASC`, auth.tenant.id, auth.tenant.id, auth.user.id);
  return db.all("SELECT payload FROM submissions WHERE tenant_id = ? ORDER BY submitted_at ASC", auth.tenant.id);
}

async function getSubmissionDetail(db, auth, submissionId) {
  const row = await db.get("SELECT * FROM submissions WHERE id = ? AND tenant_id = ?", submissionId, auth.tenant.id);
  if (!row) throw Object.assign(new Error("Submission tidak ditemukan"), { status: 404 });
  if (auth.user.role === "student") {
    if (!row.user_id || row.user_id !== auth.user.id) throw Object.assign(new Error("Siswa hanya dapat buka submission miliknya"), { status: 403 });
  } else if (auth.user.role === "teacher") {
    const classroom = row.assessment_id ? await db.get(`SELECT teacher_id FROM classes WHERE id = (SELECT class_id FROM assessments WHERE id = ? AND tenant_id = ?)`, row.assessment_id, auth.tenant.id) : null;
    if (!classroom || classroom.teacher_id !== auth.user.id) throw Object.assign(new Error("Guru hanya bisa buka submission miliknya"), { status: 403 });
  }
  return JSON.parse(row.payload);
}

function stripSubmissionAudio(submission) {
  if (!submission || typeof submission !== "object") return submission;
  const { audio: rootAudio, ...rest } = submission; const out = { ...rest };
  if (rootAudio !== undefined) out.hasAudio = true;
  if (Array.isArray(out.questionScores)) out.questionScores = out.questionScores.map((item) => {
    if (!item || item.audio === undefined) return item;
    const { audio, ...itemRest } = item; void audio; return { ...itemRest, hasAudio: true };
  });
  return out;
}

module.exports = { saveSubmission, assertCanSubmitAssessment, getVisibleSubmissions, getSubmissionDetail, stripSubmissionAudio };
