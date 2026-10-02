// Bound teacher/admin state payloads to the newest submissions so the state
// response cannot grow without limit (each row carries a large JSON payload).
const SUBMISSION_FETCH_LIMIT = 500;
const { materializeSubmission } = require("../competency-materializer");

async function refreshCompetencyState(db, tenantId, studentId, submission) {
  if (!studentId || !submission?.assessmentId) return;
  try {
    await materializeSubmission(db, tenantId, studentId, submission);
  } catch (error) {
    // Submission persistence must remain successful even if the derived
    // competency projection temporarily fails. The next competency read can
    // rebuild the projection from canonical submission data.
    console.warn("[competency-materializer] materialization skipped:", error.message);
  }
}

async function assertCanSubmitAssessment(db, tenantId, userId, assessmentId) {
  // A missing assessmentId is legitimate for flows where submissions are not
  // bound to an assessment (see migration 010_submissions_nullable_assessment).
  if (assessmentId == null) return;
  const assessment = await db.get("SELECT id, class_id, status, payload FROM assessments WHERE id = ? AND tenant_id = ?", assessmentId, tenantId);
  if (!assessment) throw Object.assign(new Error("Assessment tidak ditemukan"), { status: 404 });
  if (assessment.status !== "published") throw Object.assign(new Error("Assessment belum tersedia untuk dikerjakan"), { status: 403 });
  const membership = await db.get(
    `SELECT cm.id
     FROM assessment_classes ac
     JOIN class_memberships cm ON cm.class_id = ac.class_id
       AND cm.tenant_id = ac.tenant_id AND cm.student_id = ? AND cm.status = 'approved'
     WHERE ac.tenant_id = ? AND ac.assessment_id = ? AND ac.status = 'published'`,
    userId, tenantId, assessmentId,
  );
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
    const isForeignKey = msg.includes("FOREIGN KEY constraint failed") || msg.includes("SQLITE_CONSTRAINT_FOREIGNKEY");
    if (!isForeignKey) throw err;
    // Only a submission that never referenced an assessment may fall back to a
    // NULL assessment_id. A provided-but-missing assessment must not silently
    // create an orphan row that bypasses attempt limits and teacher queries.
    if (submission.assessmentId == null) {
      await insert(null);
      return submission;
    }
    throw Object.assign(new Error("Assessment tidak ditemukan"), { status: 404 });
  }
  await refreshCompetencyState(db, tenantId, userId, submission);
  return submission;
}

async function getVisibleSubmissions(db, auth) {
  if (auth.user.role === "student") return db.all("SELECT payload FROM submissions WHERE tenant_id = ? AND user_id = ? ORDER BY submitted_at ASC", auth.tenant.id, auth.user.id);
  if (auth.user.role === "teacher") return db.all(`SELECT s.payload FROM (SELECT s.payload, s.submitted_at FROM submissions s JOIN assessments a ON a.id = s.assessment_id WHERE s.tenant_id = ? AND a.tenant_id = ? AND a.teacher_id = ? ORDER BY s.submitted_at DESC LIMIT ${SUBMISSION_FETCH_LIMIT}) s ORDER BY s.submitted_at ASC`, auth.tenant.id, auth.tenant.id, auth.user.id);
  return db.all(`SELECT payload FROM (SELECT payload, submitted_at FROM submissions WHERE tenant_id = ? ORDER BY submitted_at DESC LIMIT ${SUBMISSION_FETCH_LIMIT}) ORDER BY submitted_at ASC`, auth.tenant.id);
}

async function getSubmissionDetail(db, auth, submissionId) {
  const row = await db.get("SELECT * FROM submissions WHERE id = ? AND tenant_id = ?", submissionId, auth.tenant.id);
  if (!row) throw Object.assign(new Error("Submission tidak ditemukan"), { status: 404 });
  if (auth.user.role === "student") {
    if (!row.user_id || row.user_id !== auth.user.id) throw Object.assign(new Error("Siswa hanya dapat buka submission miliknya"), { status: 403 });
  } else if (auth.user.role === "teacher") {
    const classroom = row.assessment_id ? await db.get(
      `SELECT c.teacher_id
       FROM assessment_classes ac
       JOIN classes c ON c.id = ac.class_id AND c.tenant_id = ac.tenant_id
       WHERE ac.tenant_id = ? AND ac.assessment_id = ? AND ac.class_id = COALESCE(?, ac.class_id)
         AND c.teacher_id = ? LIMIT 1`,
      auth.tenant.id, row.assessment_id, (() => { try { return JSON.parse(row.payload || "{}").classId || null; } catch { return null; } })(), auth.user.id,
    ) : null;
    if (!classroom || classroom.teacher_id !== auth.user.id) throw Object.assign(new Error("Guru hanya bisa buka submission miliknya"), { status: 403 });
  }
  return JSON.parse(row.payload);
}

async function getSubmissionForUpdate(db, auth, submissionId) {
  const row = await db.get("SELECT * FROM submissions WHERE id = ? AND tenant_id = ?", submissionId, auth.tenant.id);
  if (!row) throw Object.assign(new Error("Submission tidak ditemukan"), { status: 404 });
  if (auth.user.role === "teacher") {
    const assessment = row.assessment_id ? await db.get("SELECT id FROM assessments WHERE id = ? AND tenant_id = ?", row.assessment_id, auth.tenant.id) : null;
    if (!assessment) throw Object.assign(new Error("Assessment tidak ditemukan"), { status: 404 });
    let submissionClassId = null;
    try { submissionClassId = JSON.parse(row.payload || "{}").classId || null; } catch {}
    const classroom = await db.get(
      `SELECT c.teacher_id FROM assessment_classes ac
       JOIN classes c ON c.id = ac.class_id AND c.tenant_id = ac.tenant_id
       WHERE ac.tenant_id = ? AND ac.assessment_id = ? AND ac.class_id = COALESCE(?, ac.class_id)
       LIMIT 1`,
      auth.tenant.id, assessment.id, submissionClassId,
    );
    if (!classroom || classroom.teacher_id !== auth.user.id) throw Object.assign(new Error("Guru hanya boleh mengoreksi kelas miliknya"), { status: 403 });
  }
  return row;
}

async function getStudentSubmission(db, auth, submissionId) {
  const row = await db.get("SELECT * FROM submissions WHERE id = ? AND tenant_id = ? AND user_id = ?", submissionId, auth.tenant.id, auth.user.id);
  if (!row) throw Object.assign(new Error("Submission tidak ditemukan"), { status: 404 });
  return row;
}

async function saveComplaint(db, auth, submissionId, questionIndex, reason) {
  const row = await getStudentSubmission(db, auth, submissionId);
  let submission;
  try { submission = JSON.parse(row.payload); } catch { throw Object.assign(new Error("Data submission tidak valid"), { status: 500 }); }
  const qs = submission.questionScores?.[questionIndex];
  if (!qs) throw Object.assign(new Error("Soal tidak ditemukan"), { status: 400 });
  qs.complaint = { reason: String(reason).trim(), status: "pending", submittedAt: new Date().toISOString() };
  await saveSubmission(db, auth.tenant.id, auth.user.id, submission, true);
  return submission;
}

async function updateSubmissionAudio(db, tenantId, submissionId, { index, kind }, audio, options = {}) {
  const clauses = ["id = ?", "tenant_id = ?"];
  const args = [submissionId, tenantId];
  if (options.userId) {
    clauses.push("user_id = ?");
    args.push(options.userId);
  }
  let sql;
  let params;
  if (kind === "probing") {
    const probingPath = "'$.questionScores[' || CAST(? AS INTEGER) || '].probing'";
    sql = `UPDATE submissions SET payload = json_set(payload, ${probingPath}, json_set(COALESCE(json_extract(payload, ${probingPath}), json('{}')), '$.audio', ?)) WHERE ${clauses.join(" AND ")}`;
    params = [index, index, audio, ...args];
  } else {
    sql = `UPDATE submissions SET payload = json_set(payload, '$.questionScores[' || CAST(? AS INTEGER) || '].audio', ?) WHERE ${clauses.join(" AND ")}`;
    params = [index, audio, ...args];
  }
  const result = await db.run(sql, ...params);
  if (!result.changes) throw Object.assign(new Error("Submission tidak ditemukan"), { status: 404 });
}

async function updateSubmissionFeedback(db, tenantId, submissionId, fields) {
  const result = await db.run(
    `UPDATE submissions SET payload = json_set(payload, '$.evidenceFeedback', json(?), '$.evidenceQuality', json(?), '$.competencyState', json(?), '$.scoreState', ?) WHERE id = ? AND tenant_id = ?`,
    JSON.stringify(fields.evidenceFeedback),
    JSON.stringify(fields.evidenceQuality),
    JSON.stringify(fields.competencyState),
    fields.scoreState,
    submissionId,
    tenantId
  );
  if (!result.changes) throw Object.assign(new Error("Submission tidak ditemukan"), { status: 404 });
  const row = await db.get("SELECT user_id, payload FROM submissions WHERE id = ? AND tenant_id = ?", submissionId, tenantId);
  if (!row?.user_id) return;
  await refreshCompetencyState(db, tenantId, row.user_id, JSON.parse(row.payload || "{}"));
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

module.exports = { saveSubmission, assertCanSubmitAssessment, getVisibleSubmissions, getSubmissionDetail, getSubmissionForUpdate, saveComplaint, stripSubmissionAudio, updateSubmissionAudio, updateSubmissionFeedback };
