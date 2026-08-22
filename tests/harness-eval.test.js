const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

process.env.TURSO_DATABASE_URL = `file:${path.join(os.tmpdir(), `lisan-harness-eval-${Date.now()}.db`)}`;
process.env.ENABLE_DEMO_SIMULATION = "false";
process.env.HARNESS_PROVIDER = "mock";

const { initDatabase, getDb } = require("../server/database");
const { evaluateWithHarness, structuredRubric } = require("../server/harness/harness-evaluator");
const { persistEvaluationTrace } = require("../server/evaluation/trace-persister");
const { createHarness } = require("../server/harness");
const { MockProvider } = require("../server/ai/mock-provider");
const { parse } = require("../server/ai/response-parser");

const ASSESSMENT = {
  id: "assess-harness-1",
  topic: "Fotosintesis",
  difficulty: "Menengah",
  rubric: "Akurasi 40%, Kelengkapan 60%",
  questions: [
    { prompt: "Jelaskan proses fotosintesis", focus: "konsep", ideal: "proses tumbuhan membuat makanan" },
    { prompt: "Mengapa tumbuhan hijau penting?", focus: "aplikasi", ideal: "menghasilkan oksigen" },
  ],
};

test.before(async () => {
  const dbPath = process.env.TURSO_DATABASE_URL.replace(/^file:/, "");
  fs.rmSync(dbPath, { force: true });
  await initDatabase();
  // Seed a tenant + assessment so evaluation_runs FK to assessments() resolves.
  await getDb().run(
    `INSERT INTO tenants (id, name, plan, created_at) VALUES (?, ?, ?, ?)`,
    "t-harness",
    "Harness Test",
    "starter",
    new Date().toISOString()
  );
  await getDb().run(
    `INSERT INTO assessments (id, tenant_id, status, topic, difficulty, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ASSESSMENT.id,
    "t-harness",
    "published",
    ASSESSMENT.topic,
    ASSESSMENT.difficulty,
    JSON.stringify(ASSESSMENT),
    new Date().toISOString()
  );
});

test("structuredRubric parses free-text assessment rubric into weighted criteria", () => {
  const r = structuredRubric({ answers: ["a", "b"] }, ASSESSMENT, 2);
  assert.ok(Array.isArray(r.criteria));
  assert.ok(Math.abs(r.criteria.reduce((s, c) => s + c.weight, 0) - 1) < 1e-6);
  assert.equal(r.criteria.length, 2); // 40% + 60%
});

test("evaluateWithHarness returns frontend contract + harness provenance", async () => {
  const result = await evaluateWithHarness({
    assessment: ASSESSMENT,
    answers: [
      "Fotosintesis adalah proses tumbuhan membuat makanan dari cahaya matahari dan klorofil.",
      "Tumbuhan penting karena menghasilkan oksigen dan menjadi sumber makanan.",
    ],
    studentName: "Siswa A",
    tenantId: "t-harness",
    userId: "u-harness",
  });

  assert.equal(typeof result.finalScore, "number");
  assert.ok(result.finalScore >= 0 && result.finalScore <= 100);
  assert.ok(Array.isArray(result.questionScores) && result.questionScores.length === 2);
  assert.ok(result.questionScores.every((q) => typeof q.score === "number"));
  assert.ok(result.evaluationRunId);
  assert.ok(result.evaluationId);
  // LLM never computed finalScore — server-side weighted result present.
  assert.ok(result.versioning && result.versioning.harnessVersion);
  assert.ok(result.verification);
});

test("trace persister reconstructs a run from the DB", async () => {
  const harness = createHarness();
  harness.setProvider(new MockProvider()).setParser({ parse });
  harness.setTracePersister(persistEvaluationTrace);

  const result = await harness.evaluate({
    assessmentId: ASSESSMENT.id,
    assessment: ASSESSMENT,
    rubric: structuredRubric({ answers: ["x"] }, ASSESSMENT, 2),
    answers: ["jawaban A"],
    tenantId: "t-trace",
    userId: "u-trace",
  });

  // Reconstruct from DB via the harness trace API.
  const saved = await harness.trace(result.evaluationRunId);
  assert.equal(saved.available, true);
  assert.equal(saved.runId, result.evaluationRunId);
  assert.ok(Array.isArray(saved.events) && saved.events.length > 0);
  assert.ok(saved.result);
  assert.equal(saved.result.finalScore, result.finalScore);

  // Raw table checks.
  const db = getDb();
  const runRow = await db.get("SELECT * FROM evaluation_runs WHERE run_id = ?", result.evaluationRunId);
  assert.ok(runRow);
  assert.equal(runRow.final_score, result.finalScore);
  const critRows = await db.all("SELECT * FROM evaluation_criteria WHERE run_id = ?", result.evaluationRunId);
  assert.equal(critRows.length, result.criteria.length);
});