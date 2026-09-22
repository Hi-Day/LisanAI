const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

process.env.TURSO_DATABASE_URL = `file:${path.join(os.tmpdir(), `oralai-submission-audio-${Date.now()}.db`)}`;
process.env.ENABLE_DEMO_SIMULATION = "false";

const {
  approveMembership,
  createClass,
  getDb,
  getSubmissionDetail,
  initDatabase,
  requestJoinClass,
  saveAssessment,
  saveSubmission,
} = require("../server/database");
const { createTenantUser, registerTenantUser } = require("../server/auth-service");
const submissionService = require("../server/application/submission-service");
const { processEvidenceFeedback } = require("../server/evidence-feedback-service");
const { readJson } = require("../server/http-utils");

const MAIN_AUDIO = "data:audio/webm;base64,MAIN-AUDIO-AAAA";
const PROBING_AUDIO = "data:audio/webm;base64,PROBING-AUDIO-BBBB";

let context;

test.before(async () => {
  const dbPath = process.env.TURSO_DATABASE_URL.replace(/^file:/, "");
  fs.rmSync(dbPath, { force: true });
  await initDatabase();
  context = await seedScenario();
});

test("saveSubmissionAudio patches main and probing audio into the stored payload", async () => {
  const { submission, student } = context;
  const auth = { tenant: context.tenant, user: student };

  const afterMainResult = await submissionService.saveSubmissionAudio(auth, {
    id: submission.id,
    index: 0,
    kind: "main",
    audio: MAIN_AUDIO,
  });
  assert.deepEqual(afterMainResult, { ok: true });
  const afterMain = await getSubmissionDetail(auth, submission.id);
  assert.equal(afterMain.questionScores[0].audio, MAIN_AUDIO);

  const afterProbingResult = await submissionService.saveSubmissionAudio(auth, {
    id: submission.id,
    index: 1,
    kind: "probing",
    audio: PROBING_AUDIO,
  });
  assert.deepEqual(afterProbingResult, { ok: true });
  const afterProbing = await getSubmissionDetail(auth, submission.id);
  assert.equal(afterProbing.questionScores[1].probing.audio, PROBING_AUDIO);

  const stored = await getSubmissionDetail(auth, submission.id);
  assert.equal(stored.questionScores[0].audio, MAIN_AUDIO);
  assert.equal(stored.questionScores[1].probing.audio, PROBING_AUDIO);
});

test("saveSubmissionAudio can re-patch an existing probing audio without corrupting the payload", async () => {
  const { submission, student } = context;
  const auth = { tenant: context.tenant, user: student };
  const replacement = "data:audio/webm;base64,PROBING-AUDIO-CCCC";

  await submissionService.saveSubmissionAudio(auth, { id: submission.id, index: 1, kind: "probing", audio: PROBING_AUDIO });
  await submissionService.saveSubmissionAudio(auth, { id: submission.id, index: 1, kind: "probing", audio: replacement });

  const stored = await getSubmissionDetail(auth, submission.id);
  assert.equal(stored.questionScores[1].probing.audio, replacement);
});

test("evidence feedback write does not clobber patched audio (data-loss race regression)", async () => {
  const { tenant, student, assessment } = context;
  const auth = { tenant, user: student };

  const submission = {
    id: "submission-audio-race",
    assessmentId: assessment.id,
    studentName: "Siswa Audio",
    assessmentTitle: "Assessment Audio",
    finalScore: 80,
    // Index 1 has probing: null so the probing json_set must create the object.
    questionScores: [
      { prompt: "Pertanyaan 1", score: 80 },
      { prompt: "Pertanyaan 2", score: 70, probing: null },
    ],
    feedback: "Baik.",
    submittedAt: new Date().toISOString(),
  };
  await saveSubmission(tenant.id, student.id, submission, true);
  const staleSnapshot = JSON.parse(JSON.stringify(submission));

  // 1. Audio is patched AFTER the submission was saved.
  await submissionService.saveSubmissionAudio(auth, {
    id: submission.id,
    index: 0,
    kind: "main",
    audio: MAIN_AUDIO,
  });
  await submissionService.saveSubmissionAudio(auth, {
    id: submission.id,
    index: 1,
    kind: "probing",
    audio: PROBING_AUDIO,
  });

  // 2. The evidence-feedback flow then runs with the STALE pre-audio snapshot.
  await processEvidenceFeedback(auth, staleSnapshot);

  // 3. Both audio patches must survive, and the feedback fields must be added.
  const stored = await getSubmissionDetail(auth, submission.id);
  assert.equal(stored.questionScores[0].audio, MAIN_AUDIO, "main audio must survive the feedback write");
  assert.equal(stored.questionScores[1].probing.audio, PROBING_AUDIO, "probing audio must survive the feedback write");
  assert.ok(stored.evidenceFeedback, "evidenceFeedback must be persisted");
  assert.ok(stored.evidenceQuality, "evidenceQuality must be persisted");
  assert.ok(Array.isArray(stored.competencyState), "competencyState must be persisted");
  assert.equal(stored.scoreState, "VERIFIED", "scoreState must be persisted");
});

test("saveSubmissionAudio rejects audio longer than the cap with 400", async () => {
  const { submission, student } = context;
  const auth = { tenant: context.tenant, user: student };
  const oversized = "data:audio/webm;base64," + "A".repeat(3_000_000);

  await assert.rejects(
    () => submissionService.saveSubmissionAudio(auth, { id: submission.id, index: 0, kind: "main", audio: oversized }),
    (err) => err.status === 400
  );
});

test("saveSubmissionAudio rejects audio that is not a data:audio/ URL with 400", async () => {
  const { submission, student } = context;
  const auth = { tenant: context.tenant, user: student };

  await assert.rejects(
    () => submissionService.saveSubmissionAudio(auth, { id: submission.id, index: 0, kind: "main", audio: "not-audio" }),
    (err) => err.status === 400
  );
});

test("saveSubmissionAudio rejects an empty submission id with 400", async () => {
  const { student } = context;
  const auth = { tenant: context.tenant, user: student };

  await assert.rejects(
    () => submissionService.saveSubmissionAudio(auth, { id: "", index: 0, kind: "main", audio: MAIN_AUDIO }),
    (err) => err.status === 400
  );
});

test("saveSubmissionAudio rejects a missing submission with 404", async () => {
  const { student } = context;
  const auth = { tenant: context.tenant, user: student };

  await assert.rejects(
    () => submissionService.saveSubmissionAudio(auth, { id: "submission-does-not-exist", index: 0, kind: "main", audio: MAIN_AUDIO }),
    (err) => err.status === 404
  );
});

test("saveSubmissionAudio rejects an out-of-range question index with 404", async () => {
  const { submission, student } = context;
  const auth = { tenant: context.tenant, user: student };

  await assert.rejects(
    () => submissionService.saveSubmissionAudio(auth, { id: submission.id, index: 5, kind: "main", audio: MAIN_AUDIO }),
    (err) => err.status === 404
  );
});

test("saveSubmissionAudio does not let a different student patch the submission", async () => {
  const { submission, otherStudent, tenant } = context;
  const auth = { tenant, user: otherStudent };

  await assert.rejects(
    () => submissionService.saveSubmissionAudio(auth, { id: submission.id, index: 0, kind: "main", audio: "data:audio/webm;base64,OTHER" }),
    (err) => err.status === 403
  );

  const row = await getDb().get("SELECT user_id, payload FROM submissions WHERE id = ?", submission.id);
  assert.equal(row.user_id, context.student.id);
  assert.notEqual(JSON.parse(row.payload).questionScores[0].audio, "data:audio/webm;base64,OTHER");
});

test("readJson rejects a streamed body over the limit with a 413 error and does not destroy the request", async () => {
  const req = new EventEmitter();
  req.headers = {};
  let destroyed = false;
  req.destroy = () => { destroyed = true; };

  const promise = readJson(req);
  req.emit("data", Buffer.from("x".repeat(4_000_001)));
  await assert.rejects(
    promise,
    (err) => err.status === 413 && /Payload terlalu besar/.test(err.message)
  );
  assert.equal(destroyed, false, "readJson must not destroy the request (client needs the JSON error)");
});

test("readJson rejects immediately when the declared Content-Length exceeds the limit", async () => {
  const req = new EventEmitter();
  req.headers = { "content-length": String(4_000_001) };

  await assert.rejects(
    readJson(req),
    (err) => err.status === 413 && /Payload terlalu besar/.test(err.message)
  );
});

async function seedScenario() {
  const { tenant } = await registerTenantUser({
    tenantName: "Submission Audio School",
    name: "Admin Audio",
    email: "admin.audio.test@example.com",
    password: "password123",
  });
  const teacher = await createTenantUser(tenant.id, {
    name: "Guru Audio",
    email: "guru.audio.test@example.com",
    password: "password123",
    role: "teacher",
  });
  const student = await createTenantUser(tenant.id, {
    name: "Siswa Audio",
    email: "siswa.audio.test@example.com",
    password: "password123",
    role: "student",
  });
  const otherStudent = await createTenantUser(tenant.id, {
    name: "Siswa Lain",
    email: "siswa.lain.audio.test@example.com",
    password: "password123",
    role: "student",
  });

  const classroom = {
    id: "class-audio",
    name: "Kelas Audio",
    joinCode: "AUDIO001",
    createdAt: new Date().toISOString(),
  };
  await createClass(tenant.id, teacher.id, classroom);
  await requestJoinClass(tenant.id, student.id, classroom.joinCode, {
    id: "member-audio",
    requestedAt: new Date().toISOString(),
  });
  await approveMembership(tenant.id, teacher.id, "member-audio");

  const assessment = {
    id: "assessment-audio-valid",
    classId: classroom.id,
    status: "published",
    topic: "Topik Audio",
    difficulty: "Menengah",
    outcomes: "Siswa mampu menjelaskan konsep utama.",
    rubric: "Akurasi, kelengkapan, dan kejelasan.",
    questions: [{ prompt: "Jelaskan konsep utama.", ideal: "Jawaban ideal." }],
    createdAt: new Date().toISOString(),
  };
  await saveAssessment({ tenant, user: teacher }, assessment);

  const submission = {
    id: "submission-audio-1",
    assessmentId: assessment.id,
    studentName: "Siswa Audio",
    assessmentTitle: "Assessment Audio",
    finalScore: 80,
    questionScores: [{ prompt: "Pertanyaan 1" }, { prompt: "Pertanyaan 2", probing: {} }],
    feedback: "Baik.",
    submittedAt: new Date().toISOString(),
  };
  await saveSubmission(tenant.id, student.id, submission);

  return { tenant, teacher, student, otherStudent, assessment, submission };
}
