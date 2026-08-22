const { getDb } = require("../database");

/**
 * Persists evaluation trace (append-only) to the evaluation_* tables.
 * Implements the `persistTrace` contract used by AssessmentHarness.
 *
 *   persist(snapshot)                      -> write a run
 *   persist({ mode: "read", runId })       -> reconstruct a run's trace
 */
async function persistEvaluationTrace(snapshot) {
  const db = getDb();

  // Read mode: reconstruct a run.
  if (snapshot && snapshot.mode === "read") {
    return readRun(snapshot.runId);
  }

  const {
    runId,
    meta = {},
    events = [],
    context = {},
    model,
    promptVersion,
    rubricVersion,
    harnessVersion,
    engineVersion,
    result,
  } = snapshot || {};

  const vHarness = harnessVersion || "1.0.0";
  const vEngine = engineVersion || "1.0.0";

  // Upsert run metadata.
  await db.run(
    `INSERT INTO evaluation_runs
       (run_id, tenant_id, user_id, assessment_id, submission_id, model,
        prompt_version, rubric_version, harness_version, engine_version,
        final_score, verification_valid, verification_issues, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(run_id) DO NOTHING`,
    runId,
    meta.tenantId || null,
    meta.userId || null,
    result ? result.assessmentId || null : context.assessmentId || null,
    result ? result.submissionId || null : null,
    model || "unknown",
    promptVersion || "v1",
    rubricVersion || "v1",
    vHarness,
    vEngine,
    result ? result.finalScore : null,
    result && result.verification ? (result.verification.valid ? 1 : 0) : null,
    result && result.verification ? JSON.stringify(result.verification.issues || []) : null,
    new Date().toISOString()
  );

  // Events (append-only).
  let seq = 0;
  for (const ev of events || []) {
    seq += 1;
    const { type, ts, ...data } = ev;
    await db.run(
      "INSERT INTO evaluation_events (run_id, seq, type, data, ts) VALUES (?, ?, ?, ?, ?)",
      runId,
      seq,
      type,
      JSON.stringify(data || {}),
      ts || new Date().toISOString()
    );
  }

  // Result + versions.
  if (result) {
    await db.run(
      `INSERT INTO evaluation_results (run_id, evaluation_id, criteria_json, result_json, weighted_json)
       VALUES (?, ?, ?, ?, ?)`,
      runId,
      result.evaluationId || "",
      JSON.stringify(result.criteria || []),
      JSON.stringify(result),
      JSON.stringify(result.weighted || {})
    );

    await db.run(
      `INSERT INTO evaluation_versions
         (run_id, model_version, prompt_version, rubric_version, harness_version, engine_version)
       VALUES (?, ?, ?, ?, ?, ?)`,
      runId,
      result.versioning?.modelVersion || model || "unknown",
      result.versioning?.promptVersion || promptVersion || "v1",
      result.versioning?.rubricVersion || rubricVersion || "v1",
      result.versioning?.harnessVersion || harnessVersion || "1.0.0",
      result.versioning?.engineVersion || engineVersion || "1.0.0"
    );

    // Criterion rows.
    const rubricCriteria = (result.criteria || []).map((c) => c.criterionId);
    for (const c of result.criteria || []) {
      const weight = result.weighted?.detail?.find((d) => d.criterionId === c.criterionId)?.weight ?? 0;
      await db.run(
        `INSERT INTO evaluation_criteria
           (run_id, criterion_id, score, weight, rationale, confidence, evidence_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        runId,
        c.criterionId,
        c.score,
        weight,
        c.rationale || null,
        c.confidence ?? null,
        JSON.stringify(c.evidence || [])
      );
    }
  }

  return { runId, persisted: true };
}

/**
 * Reconstruct a run's trace from the database (append-only guarantee).
 */
async function readRun(runId) {
  const db = getDb();
  const run = await db.get("SELECT * FROM evaluation_runs WHERE run_id = ?", runId);
  if (!run) return { runId, available: false };
  const events = await db.all(
    "SELECT type, data, ts FROM evaluation_events WHERE run_id = ? ORDER BY seq ASC",
    runId
  );
  const result = await db.get("SELECT * FROM evaluation_results WHERE run_id = ?", runId);
  const versions = await db.get("SELECT * FROM evaluation_versions WHERE run_id = ?", runId);
  return {
    runId,
    available: true,
    run,
    events: events.map((e) => ({ type: e.type, data: JSON.parse(e.data || "{}"), ts: e.ts })),
    result: result ? JSON.parse(result.result_json) : null,
    versions,
  };
}

module.exports = { persistEvaluationTrace };