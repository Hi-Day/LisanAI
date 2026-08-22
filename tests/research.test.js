const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

process.env.TURSO_DATABASE_URL = `file:${path.join(os.tmpdir(), `lisan-research-${Date.now()}.db`)}`;
process.env.ENABLE_DEMO_SIMULATION = "false";

const { initDatabase, getDb } = require("../server/database");
const { compareAiVsHuman, saveHumanScore, rubricCompliance } = require("../server/evaluation/research");

test.before(async () => {
  const dbPath = process.env.TURSO_DATABASE_URL.replace(/^file:/, "");
  fs.rmSync(dbPath, { force: true });
  await initDatabase();

  // Seed tenant + assessment.
  await getDb().run(`INSERT INTO tenants (id, name, plan, created_at) VALUES (?,?,?,?)`, "t-r", "Research", "starter", new Date().toISOString());
  await getDb().run(
    `INSERT INTO assessments (id, tenant_id, status, topic, difficulty, payload, created_at) VALUES (?,?,?,?,?,?,?)`,
    "assess-r",
    "t-r",
    "published",
    "Topik",
    "Menengah",
    JSON.stringify({}),
    new Date().toISOString()
  );

  // Seed two evaluation runs with known final scores.
  for (const [runId, score] of [["run_1", 80], ["run_2", 90]]) {
    await getDb().run(
      `INSERT INTO evaluation_runs
         (run_id, tenant_id, user_id, assessment_id, submission_id, model,
          prompt_version, rubric_version, harness_version, engine_version,
          final_score, verification_valid, verification_issues, created_at)
       VALUES (?,?,?,?,NULL,'mock','v1','v1','1.0.0','1.0.0',?,1,'[]',?)`,
      runId,
      "t-r",
      "u-r",
      "assess-r",
      score,
      new Date().toISOString()
    );
    // criterion rows for rubricCompliance
    await getDb().run(
      `INSERT INTO evaluation_criteria (run_id, criterion_id, score, weight, rationale, confidence, evidence_json)
       VALUES (?,?,?,?,?,?,?)`,
      runId,
      "c1",
      score,
      1,
      "ok",
      0.9,
      "[]"
    );
  }
});

test("compareAiVsHuman computes metrics from persisted runs + human scores", async () => {
  await saveHumanScore({ runId: "run_1", humanScore: 82, humanFeedback: "baik", reviewerId: "r1" });
  await saveHumanScore({ runId: "run_2", humanScore: 92, humanFeedback: "baik", reviewerId: "r1" });

  const res = await compareAiVsHuman("assess-r");
  assert.equal(res.n, 2);
  assert.equal(typeof res.metrics.validity.pearson, "number");
  assert.ok(Array.isArray(res.rows) && res.rows.length === 2);
  assert.equal(res.rows[0].runId, "run_1");
});

test("saveHumanScore requires an existing run", async () => {
  await assert.rejects(
    () => saveHumanScore({ runId: "run_missing", humanScore: 50 }),
    /tidak ditemukan/
  );
});

test("rubricCompliance reports criterion coverage", async () => {
  const res = await rubricCompliance("assess-r");
  assert.equal(res.n, 2);
  assert.equal(res.totalCriterionRows, 2);
  assert.equal(res.criterionCoverage, 1);
});