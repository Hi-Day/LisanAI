const { getDb } = require("../database");
const { computeMetrics: evaluateMetrics } = require("./metrics");

/**
 * Research service (PRD §20, §33).
 * Compares baseline (legacy evaluator) vs harness evaluations for the same
 * submissions, and AI score vs human score.
 */

/**
 * Compare AI scores (harness evaluation_runs) against human scores for runs
 * that have both. Returns validity + reliability metrics + data rows.
 */
async function compareAiVsHuman(assessmentId, tenantId) {
  const db = getDb();
  const rows = await db.all(
    `SELECT r.run_id, r.final_score, h.human_score, h.human_feedback
       FROM evaluation_runs r
       JOIN evaluation_human_scores h ON h.run_id = r.run_id
      WHERE ($1 IS NULL OR r.assessment_id = $1)
        AND ($2 IS NULL OR r.tenant_id = $2)
        AND r.final_score IS NOT NULL
        AND h.human_score IS NOT NULL`,
    assessmentId || null,
    tenantId || null
  );
  const ai = rows.map((r) => r.final_score);
  const human = rows.map((r) => r.human_score);
  return {
    n: ai.length,
    metrics: ai.length ? evaluateMetrics(ai, human) : null,
    rows: rows.map((r) => ({
      runId: r.run_id,
      aiScore: r.final_score,
      humanScore: r.human_score,
      humanFeedback: r.human_feedback,
    })),
  };
}

/**
 * Compare baseline vs harness results for a set of submissions.
 * Expects rows: [{ baselineScore, harnessScore }].
 */
function compareBaselineVsHarness(pairs) {
  const baseline = pairs.map((p) => p.baselineScore);
  const harness = pairs.map((p) => p.harness);
  return {
    n: baseline.length,
    metrics: baseline.length ? evaluateMetrics(harness, baseline) : null,
    meanBaseline: baseline.length ? baseline.reduce((a, b) => a + b, 0) / baseline.length : null,
    meanHarness: harness.length ? harness.reduce((a, b) => a + b, 0) / harness.length : null,
  };
}

/**
 * Persist a human score for a given evaluation run (PRD §22).
 */
async function saveHumanScore({ runId, humanScore, humanFeedback, reviewerId }) {
  const db = getDb();
  const run = await db.get("SELECT run_id FROM evaluation_runs WHERE run_id = ?", runId);
  if (!run) throw Object.assign(new Error("Evaluation run tidak ditemukan"), { status: 404 });
  await db.run(
    `INSERT OR REPLACE INTO evaluation_human_scores
       (run_id, human_score, human_feedback, reviewed_at, reviewer_id)
     VALUES (?, ?, ?, ?, ?)`,
    runId,
    humanScore,
    humanFeedback || null,
    new Date().toISOString(),
    reviewerId || null
  );
  return { runId, humanScore };
}

/**
 * Gather per-criterion coverage metrics for a set of runs.
 */
async function rubricCompliance(assessmentId, tenantId) {
  const db = getDb();
  const rows = await db.all(
    `SELECT run_id, criterion_id, score FROM evaluation_criteria
      WHERE run_id IN (
        SELECT run_id FROM evaluation_runs
         WHERE ($1 IS NULL OR assessment_id = $1)
           AND ($2 IS NULL OR tenant_id = $2)
      )`,
    assessmentId || null,
    tenantId || null
  );
  if (rows.length === 0) return { n: 0 };
  const byRun = new Map();
  for (const r of rows) {
    if (!byRun.has(r.run_id)) byRun.set(r.run_id, []);
    byRun.get(r.run_id).push(r);
  }
  const runs = Array.from(byRun.values());
  const coverage = runs.map((c) => c.length);
  return {
    n: runs.length,
    criterionCoverage: mean(coverage),
    totalCriterionRows: rows.length,
  };
}

function mean(xs) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * Record a teacher's corrected final score as the human score for a harness
 * evaluation run (so it counts in AI-vs-human research metrics) and mark the
 * approval as `human_reviewed` so the 7-day auto-approval sweep can never
 * overwrite the correction with the AI score.
 *
 * Triggers (handled by the caller):
 *  - teacher accepted a student complaint and re-scored the submission;
 *  - teacher corrected the score directly (manual override).
 *
 * Returns { runId, humanScore, approvalStatus } or null when there is no
 * eligible run or the score did not actually change.
 */
async function recordTeacherScoreChange({ runId, finalScore, tenantId, reviewerId, reviewNote }) {
  const { markHumanReviewed } = require("./human-approval");
  if (!runId || finalScore === undefined || finalScore === null) return null;

  const db = getDb();
  const run = await db.get(
    "SELECT run_id, final_score FROM evaluation_runs WHERE run_id = ? AND tenant_id = ?",
    runId,
    tenantId || null
  );
  if (!run || run.final_score === undefined || run.final_score === null) return null;
  if (Number(run.final_score) === Number(finalScore)) return null;

  const previous = Number(run.final_score);
  const note = reviewNote ? ` ${reviewNote}` : "";
  const feedback = `Koreksi guru: skor AI ${previous} → manusia ${finalScore}.${note}`.slice(0, 2000);

  await saveHumanScore({
    runId,
    humanScore: finalScore,
    humanFeedback: feedback,
    reviewerId,
  });
  const approval = await markHumanReviewed({ runId, reviewerId });
  return {
    runId,
    previousScore: previous,
    humanScore: Number(finalScore),
    approvalStatus: (approval && approval.approval_status) || "human_reviewed",
  };
}

module.exports = {
  compareAiVsHuman,
  compareBaselineVsHarness,
  saveHumanScore,
  recordTeacherScoreChange,
  rubricCompliance,
};