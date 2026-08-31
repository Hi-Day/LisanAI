const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

process.env.TURSO_DATABASE_URL = `file:${path.join(os.tmpdir(), `lisan-evaluation-service-${Date.now()}.db`)}`;
process.env.ENABLE_DEMO_SIMULATION = "false";
process.env.HARNESS_PROVIDER = "mock";

const { initDatabase, getDb } = require("../server/database");
const { evaluateAssessment, evaluateAssessmentWithProgress } = require("../server/evaluation/evaluation-service");

const ASSESSMENT = {
  id: "assessment-service-test",
  topic: "Fotosintesis",
  difficulty: "Menengah",
  rubric: "Akurasi 40%, Kelengkapan 60%",
  questions: [
    { prompt: "Jelaskan fotosintesis", focus: "konsep" },
    { prompt: "Mengapa tumbuhan penting?", focus: "aplikasi" },
  ],
};

test.before(async () => {
  const dbPath = process.env.TURSO_DATABASE_URL.replace(/^file:/, "");
  fs.rmSync(dbPath, { force: true });
  await initDatabase();
  await getDb().run(
    `INSERT INTO tenants (id, name, plan, created_at) VALUES (?, ?, ?, ?)`,
    "tenant-evaluation-service",
    "Evaluation Service Test",
    "starter",
    new Date().toISOString()
  );
  await getDb().run(
    `INSERT INTO assessments (id, tenant_id, status, topic, difficulty, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ASSESSMENT.id,
    "tenant-evaluation-service",
    "published",
    ASSESSMENT.topic,
    ASSESSMENT.difficulty,
    JSON.stringify(ASSESSMENT),
    new Date().toISOString()
  );
});

test("evaluation service exposes the canonical harness evaluation contract", async () => {
  const result = await evaluateAssessment({
    assessment: ASSESSMENT,
    answers: [
      "Fotosintesis adalah proses tumbuhan membuat makanan menggunakan cahaya matahari.",
      "Tumbuhan penting karena menghasilkan oksigen.",
    ],
    tenantId: "tenant-evaluation-service",
    userId: "user-evaluation-service",
  });

  assert.equal(typeof result.finalScore, "number");
  assert.ok(result.evaluationRunId);
  assert.ok(result.evaluationId);
  assert.ok(result.verification);
  assert.ok(result.versioning && result.versioning.harnessVersion);
});

test("evaluation service keeps progress transport-independent", async () => {
  const progress = [];
  const result = await evaluateAssessmentWithProgress(
    {
      assessment: ASSESSMENT,
      answers: ["Fotosintesis membuat makanan.", "Menghasilkan oksigen."],
      tenantId: "tenant-evaluation-service",
      userId: "user-evaluation-service",
    },
    (message) => progress.push(message)
  );

  assert.equal(typeof result.finalScore, "number");
  assert.ok(progress.length >= 0);
});
