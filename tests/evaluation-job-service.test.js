const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

process.env.TURSO_DATABASE_URL = `file:${path.join(os.tmpdir(), `lisan-evaluation-jobs-${Date.now()}.db`)}`;

const { initDatabase, getDb } = require("../server/database");
const { enqueueEvaluation, getEvaluationJob, claimEvaluationJob } = require("../server/evaluation/evaluation-job-service");

test.before(async () => {
  const dbPath = process.env.TURSO_DATABASE_URL.replace(/^file:/, "");
  fs.rmSync(dbPath, { force: true });
  await initDatabase();
  await getDb().run(
    `INSERT INTO tenants (id, name, plan, created_at) VALUES (?, ?, ?, ?)`,
    "tenant-job-test", "Job Test", "starter", new Date().toISOString()
  );
});

test.beforeEach(async () => {
  await getDb().run(`DELETE FROM evaluation_jobs`);
});

test("enqueue persists a tenant-scoped job without auth/session secrets", async () => {
  const job = await enqueueEvaluation({
    tenantId: "tenant-job-test",
    userId: "user-job-test",
    auth: { user: { id: "secret" }, token: "should-not-persist" },
    answers: ["jawaban"],
    assessmentId: "assessment-job-test",
  });

  assert.equal(job.status, "queued");
  assert.equal(job.attempts, 0);
  const row = await getDb().get(`SELECT payload FROM evaluation_jobs WHERE id = ?`, job.id);
  const payload = JSON.parse(row.payload);
  assert.equal(payload.auth, undefined);
  assert.deepEqual(payload.answers, ["jawaban"]);
});

test("job status is tenant isolated", async () => {
  const job = await enqueueEvaluation({ tenantId: "tenant-job-test", userId: "u", answers: [] });
  assert.ok(await getEvaluationJob(job.id, "tenant-job-test"));
  assert.equal(await getEvaluationJob(job.id, "another-tenant"), null);
});

test("claim transitions exactly one queued job to running", async () => {
  const job = await enqueueEvaluation({ tenantId: "tenant-job-test", userId: "u", answers: ["x"] });
  const claimed = await claimEvaluationJob();
  assert.ok(claimed);
  assert.equal(claimed.id, job.id);
  assert.equal(claimed.status, "running");
  assert.equal(claimed.attempts, 1);
  assert.equal(await claimEvaluationJob(), null);
});
