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
 * P1-6/P1-7/P1-8 — Confidence calibration dataset + ECE/Brier.
 *
 * Builds the (confidence, correctness) pairs from the existing calibration
 * substrate: AI per-run confidence (evaluation_criteria.confidence) joined to
 * the human-reviewed scores (evaluation_human_scores). "Correct" is defined as
 * the AI score agreeing with the human score within ±tolerance.
 *
 * Returns ECE, Brier, a reliability diagram, and the per-run rows so the data
 * can be filtered by assessment/teacher/rubric/model downstream.
 */
async function compareCalibration(assessmentId, tenantId, opts = {}) {
  const db = getDb();
  const tolerance = Number(opts.tolerance ?? 5);
  const rows = await db.all(
    `SELECT r.run_id, r.final_score AS ai_score, h.human_score,
            (SELECT AVG(c.confidence) FROM evaluation_criteria c WHERE c.run_id = r.run_id) AS avg_conf
       FROM evaluation_runs r
       JOIN evaluation_human_scores h ON h.run_id = r.run_id
      WHERE ($1 IS NULL OR r.assessment_id = $1)
        AND ($2 IS NULL OR r.tenant_id = $2)
        AND r.final_score IS NOT NULL
        AND h.human_score IS NOT NULL
      ORDER BY r.created_at ASC`,
    assessmentId || null,
    tenantId || null
  );
  if (rows.length === 0) return { n: 0, ece: null, brier: null, diagram: [], rows: [], dataSufficient: false, minSamples: MIN_CALIBRATION_N };

  const { expectedCalibrationError, brierScore, calibrationBins } = require("./metrics");
  const confidence = rows.map((r) => (Number.isFinite(r.avg_conf) ? r.avg_conf : 0));
  const correctness = rows.map((r) => (Math.abs(Number(r.ai_score) - Number(r.human_score)) <= tolerance ? 1 : 0));

  return {
    n: rows.length,
    tolerance,
    ece: expectedCalibrationError(confidence, correctness),
    brier: brierScore(confidence, correctness),
    diagram: calibrationBins(confidence, correctness).bins,
    // Transparency about dataset sufficiency: below ~30 reviewed runs the ECE/
    // Brier numbers are unstable and should be read as preliminary, not as an
    // empirical claim (P1-6: measurable AND monitored; P1-29: thresholds are
    // initial operational targets, not scientific claims).
    dataSufficient: rows.length >= MIN_CALIBRATION_N,
    minSamples: MIN_CALIBRATION_N,
    rows: rows.map((r) => ({
      runId: r.run_id,
      aiScore: Number(r.ai_score),
      humanScore: Number(r.human_score),
      confidence: Number.isFinite(r.avg_conf) ? r.avg_conf : null,
      correct: Math.abs(Number(r.ai_score) - Number(r.human_score)) <= tolerance ? 1 : 0,
    })),
  };
}

// Minimum number of human-reviewed runs before calibration metrics are treated
// as meaningful. Below this the dashboard should warn rather than present ECE/
// Brier as stable (P1-6 monitoring principle).
const MIN_CALIBRATION_N = 30;

/**
 * P1-20 — Reliability dashboard aggregate for a tenant.
 * Pulls together human agreement, evidence validity, review/retry rates, and
 * cost/latency (P1-12/P1-13) from the existing telemetry tables.
 */
async function reliabilityDashboard(tenantId) {
  const db = getDb();
  const { adjacentAgreement, std } = require("./metrics");

  // Human agreement on runs that have a reviewed human score.
  const scored = await db.all(
    `SELECT r.final_score AS ai, h.human_score AS human
       FROM evaluation_runs r
       JOIN evaluation_human_scores h ON h.run_id = r.run_id
      WHERE r.tenant_id = $1 AND r.final_score IS NOT NULL AND h.human_score IS NOT NULL`,
    tenantId || null
  );
  const nReviewed = scored.length;
  const ai = scored.map((r) => Number(r.ai));
  const human = scored.map((r) => Number(r.human));
  const humanAgreement = nReviewed > 0 ? adjacentAgreement(ai, human) : null;

  // Evidence validity + review rate from the verification gate.
  const runs = await db.all(
    `SELECT verification_status, requires_human_review, final_score
       FROM evaluation_runs WHERE tenant_id = $1`,
    tenantId || null
  );
  const total = runs.length;
  const evidenceFailure = total ? runs.filter((r) => r.verification_status === "FAIL").length : 0;
  const reviewCount = total ? runs.filter((r) => r.requires_human_review === 1 || r.verification_status === "REVIEW").length : 0;
  const evidenceValidity = total ? round(1 - evidenceFailure / total, 4) : null;
  const reviewRate = total ? round(reviewCount / total, 4) : null;

  // Cost + latency from ai_logs (P1-13 cost attribution, P1-12 observability).
  const aiStats = await db.get(
    `SELECT COUNT(*) AS calls,
            SUM(COALESCE(cost_usd, 0)) AS cost,
            SUM(CASE WHEN retry_count > 0 THEN 1 ELSE 0 END) AS retried,
            AVG(latency_ms) AS avg_latency
       FROM ai_logs WHERE tenant_id = $1`,
    tenantId || null
  );
  const latRows = await db.all(
    `SELECT latency_ms FROM ai_logs
      WHERE tenant_id = $1 AND latency_ms IS NOT NULL ORDER BY latency_ms ASC`,
    tenantId || null
  );
  const lats = latRows.map((r) => r.latency_ms);
  const calls = Number(aiStats?.calls || 0);
  const retryRate = calls ? round(Number(aiStats?.retried || 0) / calls, 4) : null;
  const avgCost = calls ? Number(aiStats?.cost || 0) / calls : null;
  const p95 = percentile(lats, 95);

  return {
    tenantId,
    nRuns: total,
    nReviewed,
    humanAgreement: humanAgreement == null ? null : round(humanAgreement, 4),
    aiStd: nReviewed ? round(std(ai), 4) : null,
    evidenceValidity,
    reviewRate,
    evidenceFailure,
    retryRate,
    avgCost: avgCost == null ? null : round(avgCost, 6),
    p95LatencyMs: p95,
    averageCostUsd: avgCost == null ? null : round(avgCost, 6),
  };
}

/**
 * P1-19 — Drift detection. Compares recent human agreement against an older
 * baseline. When recent reliability drops below baseline by more than
 * `threshold`, emits EVALUATION_DRIFT.
 */
async function detectDrift(tenantId, opts = {}) {
  const db = getDb();
  const baselineDays = Number(opts.baselineDays ?? 30);
  const recentDays = Number(opts.recentDays ?? 7);
  const threshold = Number(opts.threshold ?? 0.05);
  const minN = Number(opts.minN ?? 10);

  const rows = await db.all(
    `SELECT r.created_at, r.final_score AS ai, h.human_score AS human
       FROM evaluation_runs r
       JOIN evaluation_human_scores h ON h.run_id = r.run_id
      WHERE r.tenant_id = $1
        AND r.final_score IS NOT NULL
        AND h.human_score IS NOT NULL`,
    tenantId || null
  );
  const now = Date.now();
  const recentCutoff = now - recentDays * 86400_000;
  const baselineCutoff = now - baselineDays * 86400_000;
  const recent = rows.filter((r) => Date.parse(r.created_at) > recentCutoff);
  const baseline = rows.filter((r) => Date.parse(r.created_at) <= recentCutoff && Date.parse(r.created_at) > baselineCutoff);

  const { adjacentAgreement } = require("./metrics");
  const agg = (arr) => {
    if (arr.length < minN) return null;
    const a = arr.map((r) => Number(r.ai));
    const b = arr.map((r) => Number(r.human));
    return { agreement: adjacentAgreement(a, b), n: arr.length };
  };

  const recentAgg = agg(recent);
  const baselineAgg = agg(baseline);
  const detected =
    recentAgg && baselineAgg && baselineAgg.agreement - recentAgg.agreement > threshold;

  return {
    detected,
    recent: recentAgg,
    baseline: baselineAgg,
    threshold,
    metric: "human_agreement_within_5",
    reason: detected
      ? `Human agreement fell from ${round(baselineAgg.agreement, 4)} to ${round(recentAgg.agreement, 4)} (Δ ${round(baselineAgg.agreement - recentAgg.agreement, 4)} > ${threshold}).`
      : null,
  };
}

/**
 * P1-10 — Repeatability summary over runs that share the same input_hash
 * (same submission re-evaluated under identical configuration).
 */
async function repeatabilitySummary(tenantId) {
  const db = getDb();
  const rows = await db.all(
    `SELECT input_hash, final_score, created_at
       FROM evaluation_runs
      WHERE tenant_id = $1 AND input_hash IS NOT NULL AND final_score IS NOT NULL
      ORDER BY input_hash, created_at ASC`,
    tenantId || null
  );
  const byHash = new Map();
  for (const r of rows) {
    if (!byHash.has(r.input_hash)) byHash.set(r.input_hash, []);
    byHash.get(r.input_hash).push(Number(r.final_score));
  }
  const { scoreStability } = require("./metrics");
  const groups = [];
  for (const [hash, scores] of byHash) {
    if (scores.length < 2) continue;
    groups.push({ inputHash: hash, n: scores.length, ...scoreStability(scores) });
  }
  if (!groups.length) return { n: 0, stableRatio: null, meanAbsDiff: null, groups: [] };
  const stableRatio = mean(groups.map((g) => g.stableRatio));
  const meanAbsDiff = mean(groups.map((g) => g.meanAbsDiff));
  return { n: groups.length, stableRatio: round(stableRatio, 4), meanAbsDiff: round(meanAbsDiff, 4), groups };
}

function percentile(sortedArr, p) {
  if (!sortedArr.length) return null;
  const idx = Math.min(sortedArr.length - 1, Math.ceil((p / 100) * sortedArr.length) - 1);
  return Math.round(sortedArr[Math.max(0, idx)]);
}

function round(v, places = 4) {
  const f = 10 ** places;
  return Math.round((v + Number.EPSILON) * f) / f;
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
  compareCalibration,
  reliabilityDashboard,
  detectDrift,
  repeatabilitySummary,
};