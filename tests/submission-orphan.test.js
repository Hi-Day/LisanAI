const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

process.env.TURSO_DATABASE_URL = `file:${path.join(os.tmpdir(), `oralai-orphan-${Date.now()}.db`)}`;
process.env.ENABLE_DEMO_SIMULATION = "false";

const {
  approveMembership,
  createClass,
  getDb,
  initDatabase,
  requestJoinClass,
  saveAssessment,
  saveSubmission,
} = require("../server/database");
const { createTenantUser, registerTenantUser } = require("../server/auth-service");

let context;

test.before(async () => {
  const dbPath = process.env.TURSO_DATABASE_URL.replace(/^file:/, "");
  fs.rmSync(dbPath, { force: true });
  await initDatabase();
  context = await seedScenario();
});

test("new submission with a non-existent assessmentId is rejected with 404 and inserts no row", async () => {
  const { tenant, student } = context;

  await assert.rejects(
    () => saveSubmission(tenant.id, student.id, createSubmission("ghost-assessment-not-in-db", "orphan-sub-1")),
    (err) => err.status === 404 && /Assessment tidak ditemukan/.test(err.message)
  );

  const row = await getDb().get("SELECT id FROM submissions WHERE id = ?", "orphan-sub-1");
  assert.ok(!row, "no orphan submission row may be persisted");
});

test("submission without an assessmentId is still saved (nullable by design)", async () => {
  const { tenant, student } = context;

  const saved = await saveSubmission(tenant.id, student.id, createSubmission(null, "orphan-sub-null"));
  assert.equal(saved.id, "orphan-sub-null");

  const row = await getDb().get("SELECT id, assessment_id FROM submissions WHERE id = ?", "orphan-sub-null");
  assert.ok(row, "nullable submission must be persisted");
  assert.equal(row.assessment_id, null);
});

test("valid submission for an existing published assessment still saves (regression)", async () => {
  const { tenant, student, assessment } = context;

  const saved = await saveSubmission(tenant.id, student.id, createSubmission(assessment.id, "orphan-sub-valid"));
  assert.equal(saved.id, "orphan-sub-valid");

  const row = await getDb().get("SELECT id, assessment_id FROM submissions WHERE id = ?", "orphan-sub-valid");
  assert.ok(row, "valid submission must be persisted");
  assert.equal(row.assessment_id, assessment.id);
});

async function seedScenario() {
  const { tenant } = await registerTenantUser({
    tenantName: "Orphan Test School",
    name: "Admin Orphan",
    email: "admin.orphan.test@example.com",
    password: "password123",
  });
  const teacher = await createTenantUser(tenant.id, {
    name: "Guru Orphan",
    email: "guru.orphan.test@example.com",
    password: "password123",
    role: "teacher",
  });
  const student = await createTenantUser(tenant.id, {
    name: "Siswa Orphan",
    email: "siswa.orphan.test@example.com",
    password: "password123",
    role: "student",
  });

  const classroom = {
    id: "class-orphan",
    name: "Kelas Orphan",
    joinCode: "ORPHAN01",
    createdAt: new Date().toISOString(),
  };
  await createClass(tenant.id, teacher.id, classroom);
  await requestJoinClass(tenant.id, student.id, classroom.joinCode, {
    id: "member-orphan",
    requestedAt: new Date().toISOString(),
  });
  await approveMembership(tenant.id, teacher.id, "member-orphan");

  const assessment = {
    id: "assessment-orphan-valid",
    classId: classroom.id,
    status: "published",
    topic: "Topik Orphan",
    difficulty: "Menengah",
    outcomes: "Siswa mampu menjelaskan konsep utama.",
    rubric: "Akurasi, kelengkapan, dan kejelasan.",
    questions: [{ prompt: "Jelaskan konsep utama.", ideal: "Jawaban ideal." }],
    createdAt: new Date().toISOString(),
  };
  await saveAssessment({ tenant, user: teacher }, assessment);

  return { tenant, teacher, student, assessment };
}

function createSubmission(assessmentId, id) {
  return {
    id,
    assessmentId,
    studentName: "Siswa Orphan",
    assessmentTitle: "Assessment Orphan",
    finalScore: 80,
    questionScores: [],
    feedback: "Baik.",
    submittedAt: new Date().toISOString(),
  };
}
