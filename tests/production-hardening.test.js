const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

process.env.TURSO_DATABASE_URL = `file:${path.join(os.tmpdir(), `oralai-production-hardening-${Date.now()}.db`)}`;
process.env.ENABLE_DEMO_SIMULATION = "false";

const {
  approveMembership,
  createClass,
  getDb,
  getState,
  getSubmissionDetail,
  initDatabase,
  requestJoinClass,
  saveAssessment,
  saveSubmission,
  updateAssessment,
} = require("../server/database");
const { createTenantUser, registerTenantUser } = require("../server/auth-service");
const submissionService = require("../server/application/submission-service");
const submissionRepository = require("../server/database/submission-repository");
const { validateScores } = require("../server/application/score-validation-service");
const { approveRun } = require("../server/evaluation/human-approval");
const research = require("../server/evaluation/research");
const { applyTeacherCorrection } = require("../server/evaluation/teacher-correction");
const { buildAdaptiveProbe } = require("../server/application/evaluation-service");

let ctx;

test.before(async () => {
  fs.rmSync(process.env.TURSO_DATABASE_URL.replace(/^file:/, ""), { force: true });
  await initDatabase();

  const { tenant, user: admin } = await registerTenantUser({ tenantName: "Hardening", name: "Admin", email: "admin.hardening@example.com", password: "password123" });
  const teacher = await createTenantUser(tenant.id, { name: "Dosen", email: "dosen.hardening@example.com", password: "password123", role: "teacher" });
  const student = await createTenantUser(tenant.id, { name: "Mahasiswa", email: "mhs.hardening@example.com", password: "password123", role: "student" });
  const classroom = { id: "class-hardening", name: "Kelas", joinCode: "HARDEN01", createdAt: new Date().toISOString() };
  await createClass(tenant.id, teacher.id, classroom);
  await requestJoinClass(tenant.id, student.id, classroom.joinCode, { id: "member-hardening", requestedAt: new Date().toISOString() });
  await approveMembership(tenant.id, teacher.id, "member-hardening");
  ctx = {
    tenant, admin, teacher, student, classroom,
    teacherAuth: { tenant, user: teacher },
    studentAuth: { tenant, user: student },
  };
});

function assessment(id, extra = {}) {
  return {
    id,
    classId: "class-hardening",
    status: "published",
    topic: "Topik",
    difficulty: "Menengah",
    outcomes: "Mahasiswa mampu menjelaskan konsep utama.",
    rubric: "Akurasi, kelengkapan, dan kejelasan.",
    questions: [{ id: "q-0", prompt: "Jelaskan konsep utama.", outcome: "Mahasiswa mampu menjelaskan konsep utama.", learningOutcomeId: "LO1", ideal: "Jawaban ideal." }],
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

function submission(id, assessmentId, extra = {}) {
  return {
    id, assessmentId, studentName: "Mahasiswa", assessmentTitle: "Topik", finalScore: 80,
    questionScores: [{ question: "Soal 1", score: 80 }, { question: "Soal 2", score: 80 }],
    feedback: "Baik.", submittedAt: new Date().toISOString(), ...extra,
  };
}

test("saving an assessment again keeps its submissions (no REPLACE cascade)", async () => {
  const item = assessment("assessment-keep");
  await saveAssessment(ctx.teacherAuth, item);
  await saveSubmission(ctx.tenant.id, ctx.student.id, submission("sub-keep", item.id));
  await saveAssessment(ctx.teacherAuth, { ...item, topic: "Topik baru" });
  const row = await getDb().get("SELECT COUNT(*) AS n FROM submissions WHERE assessment_id = ?", item.id);
  assert.equal(Number(row.n), 1);
});

test("an assessment id owned by another tenant cannot be taken over", async () => {
  const item = assessment("assessment-foreign");
  await saveAssessment(ctx.teacherAuth, item);
  const other = await registerTenantUser({ tenantName: "Lain", name: "Admin Lain", email: "admin.lain.hardening@example.com", password: "password123" });
  await createClass(other.tenant.id, other.user.id, { id: "class-foreign", name: "Kelas Lain", joinCode: "FOREIGN1", createdAt: new Date().toISOString() });
  await assert.rejects(
    () => saveAssessment({ tenant: other.tenant, user: other.user }, { ...item, classId: "class-foreign" }),
    (error) => error.status === 409,
  );
  const row = await getDb().get("SELECT tenant_id FROM assessments WHERE id = ?", item.id);
  assert.equal(row.tenant_id, ctx.tenant.id);
});

test("re-saving a submission keeps its attempt binding and integrity hashes", async () => {
  const item = assessment("assessment-columns");
  await saveAssessment(ctx.teacherAuth, item);
  const sub = submission("sub-columns", item.id);
  await saveSubmission(ctx.tenant.id, ctx.student.id, sub, true);
  await getDb().run("UPDATE submissions SET attempt_id = ?, assessment_hash = ? WHERE id = ?", "attempt-x", "hash-x", sub.id);
  await submissionService.saveComplaint(ctx.studentAuth, sub.id, 0, "Mohon ditinjau");
  const row = await getDb().get("SELECT attempt_id, assessment_hash FROM submissions WHERE id = ?", sub.id);
  assert.equal(row.attempt_id, "attempt-x");
  assert.equal(row.assessment_hash, "hash-x");
});

test("a lecturer correction keeps recordings and evidence, and the server recomputes the final score", async () => {
  const item = assessment("assessment-correction");
  await saveAssessment(ctx.teacherAuth, item);
  const sub = submission("sub-correction", item.id, { criteria: [{ criterionId: "akurasi" }], integrity: { attemptId: "a1" } });
  await saveSubmission(ctx.tenant.id, ctx.student.id, sub, true);
  await submissionService.saveSubmissionAudio(ctx.studentAuth, { id: sub.id, index: 0, kind: "main", audio: "data:audio/webm;base64,AAAA" });

  // The browser sends its list copy: no audio, no evidence, and a made-up final score.
  const { submission: saved } = await submissionService.saveTeacherSubmission(ctx.teacherAuth, {
    id: sub.id, finalScore: 1, questionScores: [{ score: 90 }, { score: 80 }],
  });
  assert.equal(saved.finalScore, 85);
  assert.deepEqual(saved.criteria, [{ criterionId: "akurasi" }]);
  assert.deepEqual(saved.integrity, { attemptId: "a1" });

  const detail = await getSubmissionDetail(ctx.teacherAuth, sub.id);
  assert.equal(detail.questionScores[0].audio, "data:audio/webm;base64,AAAA");
  assert.equal(detail.questionScores[0].score, 90);
});

test("applyTeacherCorrection: weighted, bounded, and exact when nothing changes", () => {
  const stored = { finalScore: 77.5, questionScores: [{ score: 70 }, { score: 90 }] };
  assert.equal(applyTeacherCorrection(stored, { questionScores: [{ score: 70 }, { score: 90 }] }).finalScore, 77.5);
  assert.equal(applyTeacherCorrection(stored, { questionScores: [{ score: 80 }, { score: 90 }] }, [0.25, 0.75]).finalScore, 80);
  // The AI sentence that states the old score is removed once the score is corrected.
  const outdated = applyTeacherCorrection({ ...stored, feedback: "Evaluasi selesai. Skor akhir 78 dari 100." }, { questionScores: [{ score: 80 }, { score: 90 }] });
  assert.equal(outdated.feedback, "Evaluasi selesai.");
  assert.equal(applyTeacherCorrection({ finalScore: 99, questionScores: [{ score: 50 }] }, { questionScores: [{ score: 100 }] }).finalScore, 100);
  assert.throws(() => applyTeacherCorrection(stored, { questionScores: [{ score: 140 }] }), (error) => error.status === 400);
  // A complaint can be decided but not invented, and the student's reason is kept.
  const withComplaint = { finalScore: 70, questionScores: [{ score: 70, complaint: { reason: "alasan", status: "pending" } }, { score: 70 }] };
  const decided = applyTeacherCorrection(withComplaint, { questionScores: [{ complaint: { status: "resolved", reason: "diubah", response: "ok" } }, { complaint: { status: "resolved" } }] });
  assert.equal(decided.questionScores[0].complaint.reason, "alasan");
  assert.equal(decided.questionScores[0].complaint.status, "resolved");
  assert.equal(decided.questionScores[1].complaint, undefined);
});

test("recordings are stored outside the payload and the state response stays small", async () => {
  const item = assessment("assessment-audio-table");
  await saveAssessment(ctx.teacherAuth, item);
  const sub = submission("sub-audio-table", item.id, { questionScores: [{ question: "Soal 1", score: 80, probing: { prompt: "Lanjutan", answer: "Jawab" } }] });
  await saveSubmission(ctx.tenant.id, ctx.student.id, sub, true);
  await submissionService.saveSubmissionAudio(ctx.studentAuth, { id: sub.id, index: 0, kind: "main", audio: "data:audio/webm;base64,MAIN" });
  await submissionService.saveSubmissionAudio(ctx.studentAuth, { id: sub.id, index: 0, kind: "probing", audio: "data:audio/webm;base64,PROBE" });

  const row = await getDb().get("SELECT payload FROM submissions WHERE id = ?", sub.id);
  assert.doesNotMatch(row.payload, /base64/);
  const state = await getState(ctx.teacherAuth);
  const listed = state.submissions.find((entry) => entry.id === sub.id);
  assert.equal(listed.questionScores[0].hasAudio, true);
  assert.equal(listed.questionScores[0].probing.hasAudio, true);
  assert.doesNotMatch(JSON.stringify(state), /base64/);
  assert.equal(state.submissionsTruncated, false);

  const detail = await getSubmissionDetail(ctx.teacherAuth, sub.id);
  assert.equal(detail.questionScores[0].audio, "data:audio/webm;base64,MAIN");
  assert.equal(detail.questionScores[0].probing.audio, "data:audio/webm;base64,PROBE");
});

test("legacy inline probing audio is stripped from list responses", () => {
  const stripped = submissionRepository.stripSubmissionAudio({ questionScores: [{ audio: "A", probing: { audio: "B", prompt: "p" } }] });
  assert.deepEqual(stripped.questionScores[0], { hasAudio: true, probing: { prompt: "p", hasAudio: true } });
});

test("the attempt deadline includes grace for setup and follow-up generation", async () => {
  const item = assessment("assessment-grace", { timeLimit: 60, questions: [
    { id: "q-0", prompt: "Soal A", outcome: "Mahasiswa mampu menjelaskan konsep utama.", learningOutcomeId: "LO1", ideal: "x", probing: true },
    { id: "q-1", prompt: "Soal B", outcome: "Mahasiswa mampu menjelaskan konsep utama.", learningOutcomeId: "LO1", ideal: "x" },
  ] });
  await saveAssessment(ctx.teacherAuth, item);
  const attempt = await submissionService.createAssessmentAttempt(ctx.studentAuth, item.id);
  const seconds = Math.round((Date.parse(attempt.deadlineAt) - Date.parse(attempt.startedAt)) / 1000);
  assert.equal(seconds, 3 * 60 + 60 + 20);
});

test("answers are stored at the first submit; a retry after the deadline is still accepted", async () => {
  const item = assessment("assessment-first-submit", { timeLimit: 60 });
  await saveAssessment(ctx.teacherAuth, item);
  const attempt = await submissionService.createAssessmentAttempt(ctx.studentAuth, item.id);

  const first = await submissionService.beginAttemptEvaluation(ctx.studentAuth, attempt.id, ["jawaban asli"], item.id);
  assert.deepEqual(first.answers, ["jawaban asli"]);
  // The AI fails, the attempt is released, and the deadline passes before the retry.
  await submissionService.releaseAttemptEvaluation(ctx.studentAuth, attempt.id);
  await getDb().run("UPDATE assessment_attempts SET deadline_at = ? WHERE id = ?", new Date(Date.now() - 1000).toISOString(), attempt.id);
  await getDb().run("UPDATE assessment_attempts SET first_submitted_at = ? WHERE id = ?", new Date(Date.now() - 5000).toISOString(), attempt.id);

  const retry = await submissionService.beginAttemptEvaluation(ctx.studentAuth, attempt.id, ["jawaban lain"], item.id);
  assert.deepEqual(retry.answers, ["jawaban asli"]);
});

test("a first submit after the deadline expires the attempt but keeps the answers as evidence", async () => {
  const item = assessment("assessment-late", { timeLimit: 60 });
  await saveAssessment(ctx.teacherAuth, item);
  const attempt = await submissionService.createAssessmentAttempt(ctx.studentAuth, item.id);
  await getDb().run("UPDATE assessment_attempts SET deadline_at = ? WHERE id = ?", new Date(Date.now() - 1000).toISOString(), attempt.id);
  await assert.rejects(
    () => submissionService.beginAttemptEvaluation(ctx.studentAuth, attempt.id, ["terlambat"], item.id),
    (error) => error.code === "ATTEMPT_EXPIRED",
  );
  const row = await getDb().get("SELECT status, answers_json FROM assessment_attempts WHERE id = ?", attempt.id);
  assert.equal(row.status, "EXPIRED");
  assert.deepEqual(JSON.parse(row.answers_json), ["terlambat"]);
});

test("questions cannot be edited while a student is mid-exam, but other fields can", async () => {
  const item = assessment("assessment-in-progress");
  await saveAssessment(ctx.teacherAuth, item);
  await submissionService.createAssessmentAttempt(ctx.studentAuth, item.id);
  await assert.rejects(
    () => updateAssessment(ctx.teacherAuth, item.id, { questions: [{ ...item.questions[0], prompt: "Soal diubah." }] }),
    (error) => error.status === 409 && error.code === "ASSESSMENT_IN_PROGRESS",
  );
  const updated = await updateAssessment(ctx.teacherAuth, item.id, { maxAttempts: 2 });
  assert.equal(updated.maxAttempts, 2);
});

test("re-entering a join code does not demote an approved student", async () => {
  await requestJoinClass(ctx.tenant.id, ctx.student.id, ctx.classroom.joinCode, { id: "member-again", requestedAt: new Date().toISOString() });
  const row = await getDb().get("SELECT status FROM class_memberships WHERE class_id = ? AND student_id = ?", ctx.classroom.id, ctx.student.id);
  assert.equal(row.status, "approved");
});

async function insertRun(runId, tenantId, finalScore) {
  await getDb().run(
    `INSERT INTO evaluation_runs
       (run_id, tenant_id, model, prompt_version, rubric_version, harness_version, engine_version,
        final_score, verification_valid, verification_issues, created_at)
     VALUES (?, ?, 'mock', 'v1', 'v1', 'v1', 'v1', ?, 1, '[]', ?)`,
    runId, tenantId, finalScore, new Date().toISOString(),
  );
}

test("human scores are tenant-scoped", async () => {
  await insertRun("run-tenant-scope", ctx.tenant.id, 70);
  await assert.rejects(() => approveRun({ runId: "run-tenant-scope", tenantId: "tenant-other", reviewerId: "x", humanScore: 10 }), (error) => error.status === 404);
  await assert.rejects(() => research.saveHumanScore({ runId: "run-tenant-scope", tenantId: "tenant-other", humanScore: 10 }), (error) => error.status === 404);
});

test("releasing a score is not counted as an independent human rating", async () => {
  await insertRun("run-validation", ctx.tenant.id, 70);
  await insertRun("run-independent", ctx.tenant.id, 70);
  await approveRun({ runId: "run-validation", tenantId: ctx.tenant.id, reviewerId: ctx.teacher.id, humanScore: 70, source: "validation" });
  await approveRun({ runId: "run-independent", tenantId: ctx.tenant.id, reviewerId: ctx.teacher.id, humanScore: 60 });
  // A later release must not overwrite the independent rating.
  await approveRun({ runId: "run-independent", tenantId: ctx.tenant.id, reviewerId: ctx.teacher.id, humanScore: 70, source: "validation" });

  const compared = await research.compareAiVsHuman(null, ctx.tenant.id);
  const ids = compared.rows.map((row) => row.runId);
  assert.ok(ids.includes("run-independent"));
  assert.ok(!ids.includes("run-validation"));
  assert.equal(compared.rows.find((row) => row.runId === "run-independent").humanScore, 60);
});

test("one invalid score does not hide the rest of a validation batch", async () => {
  const item = assessment("assessment-validate");
  await saveAssessment(ctx.teacherAuth, item);
  await saveSubmission(ctx.tenant.id, ctx.student.id, submission("sub-valid", item.id, { scoreRelease: { status: "pending" } }), true);
  await saveSubmission(ctx.tenant.id, ctx.student.id, submission("sub-invalid", item.id, { finalScore: 140, scoreRelease: { status: "pending" } }), true);
  const result = await validateScores(ctx.teacherAuth, ["sub-valid", "sub-invalid"]);
  assert.deepEqual(result.validated, ["sub-valid"]);
  assert.deepEqual(result.invalid.map((entry) => entry.id), ["sub-invalid"]);
  await assert.rejects(() => validateScores(ctx.teacherAuth, ["sub-invalid"]), (error) => error.code === "INVALID_SCORE");
});

test("a student never receives a baseline score from probing", async () => {
  process.env.HARNESS_PROVIDER = "mock";
  const probe = await buildAdaptiveProbe(
    { prompt: "Jelaskan konsep utama.", answer: "Karena begitu.", probing: true, question: { prompt: "Jelaskan konsep utama.", probing: true }, tenantId: ctx.tenant.id, userId: ctx.student.id },
    ctx.studentAuth,
  );
  assert.equal(probe.baselineScore, null);
  assert.deepEqual(probe.baselineEvidence, []);
});
