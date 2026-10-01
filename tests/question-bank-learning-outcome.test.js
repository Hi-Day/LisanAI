const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

process.env.TURSO_DATABASE_URL = `file:${path.join(os.tmpdir(), `oralai-question-bank-lo-${Date.now()}.db`)}`;
process.env.ENABLE_DEMO_SIMULATION = "false";

const {
  getDb,
  initDatabase,
  saveQuestionToBank,
  listQuestionBank,
  deleteQuestionFromBank,
} = require("../server/database");
const { registerTenantUser } = require("../server/auth-service");

test("question bank preserves learning outcome IDs across save/list", async () => {
  const dbPath = process.env.TURSO_DATABASE_URL.replace(/^file:/, "");
  fs.rmSync(dbPath, { force: true });
  await initDatabase();

  const { tenant, user } = await registerTenantUser({
    tenantName: "Question Bank LO School",
    name: "Teacher LO",
    email: `teacher.lo.${Date.now()}@example.com`,
    password: "password123",
  });
  const auth = { tenant, user };

  const saved = await saveQuestionToBank(auth, {
    topic: "Domain Adaptation",
    difficulty: "Sedang",
    prompt: "Jelaskan bagaimana domain shift memengaruhi model.",
    focus: "domain shift",
    outcome: "Siswa mampu menjelaskan dampak domain shift.",
    learningOutcomeIds: ["LO2"],
    learningOutcomeId: "LO2",
    rubric: "Ketepatan: 100%",
    ideal: "Jawaban menjelaskan...",
    criteria: [{ id: "c1", name: "Ketepatan", weight: 100 }],
  });

  const questions = await listQuestionBank(auth, {});
  const question = questions.find((item) => item.id === saved.id);
  assert.ok(question);
  assert.deepEqual(question.learningOutcomeIds, ["LO2"]);
  assert.equal(question.learningOutcomeId, "LO2");
  assert.equal(question.outcome, "Siswa mampu menjelaskan dampak domain shift.");

  await deleteQuestionFromBank(auth, saved.id);
  assert.equal((await listQuestionBank(auth, {})).some((item) => item.id === saved.id), false);

  await getDb().close?.();
});
