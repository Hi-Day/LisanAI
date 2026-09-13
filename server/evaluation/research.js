const researchRepository = require("../database/research-repository");
const { computeMetrics: evaluateMetrics, expectedCalibrationError, brierScore, calibrationBins, adjacentAgreement, std, scoreStability } = require("./metrics");

/**
 * Research service (PRD §20, §33).
 * Business calculations stay here; persistence is delegated to the repository.
 */

async function compareAiVsHuman(assessmentId, tenantId) {
  const rows = await researchRepository.listAiVsHumanRows(assessmentId, tenantId);
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

async function saveHumanScore({ runId, humanScore, humanFeedback, reviewerId }) {
  const run = await researchRepository.getEvaluationRunScore(runId, null);
  if (!run) throw Object.assign(new Error("Evaluation run tidak ditemukan"), { status: 404 });
  await researchRepository.saveHumanScore({ runId, humanScore, humanFeedback, reviewerId });
  return { runId, humanScore };
}

async function rubricCompliance(assessmentId, tenantId) {
  const rows = await researchRepository.listRubricComplianceRows(assessmentId, tenantId);
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

async function compareCalibration(assessmentId, tenantId, opts = {}) {
  const tolerance = Number(opts.tolerance ?? 5);
  const rows = await researchRepository.listCalibrationRows(assessmentId, tenantId);
  if (rows.length === 0) {
    return { n: 0, ece: null, brier: null, diagram: [], rows: [], dataSufficient: false, minSamples: MIN_CALIBRATION_N };
  }

  const confidence = rows.map((r) => (Number.isFinite(r.avg_conf) ? r.avg_conf : 0));
  const correctness = rows.map((r) => (Math.abs(Number(r.ai_score) - Number(r.human_score)) <= tolerance ? 1 : 0));

  return {
    n: rows.length,
    tolerance,
    ece: expectedCalibrationError(confidence, correctness),
    brier: brierScore(confidence, correctness),
    diagram: calibrationBins(confidence, correctness).bins,
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

const MIN_CALIBRATION_N = 30;

async function reliabilityDashboard(tenantId) {
  const [scored, runs, aiStats, latRows] = await Promise.all([
    researchRepository.listReviewedScoreRows(tenantId),
    researchRepository.listReliabilityRuns(tenantId),
    researchRepository.getAiLogStats(tenantId),
    researchRepository.listAiLogLatencies(tenantId),
  ]);

  const nReviewed = scored.length;
  const ai = scored.map((r) => Number(r.ai));
  const human = scored.map((r) => Number(r.human));
  const humanAgreement = nReviewed > 0 ? adjacentAgreement(ai, human) : null;

  const total = runs.length;
  const evidenceFailure = total ? runs.filter((r) => r.verification_status === "FAIL").length : 0;
  const reviewCount = total ? runs.filter((r) => r.requires_human_review === 1 || r.verification_status === "REVIEW").length : 0;
  const evidenceValidity = total ? round(1 - evidenceFailure / total, 4) : null;
  const reviewRate = total ? round(reviewCount / total, 4) : null;

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

async function detectDrift(tenantId, opts = {}) {
  const baselineDays = Number(opts.baselineDays ?? 30);
  const recentDays = Number(opts.recentDays ?? 7);
  const threshold = Number(opts.threshold ?? 0.05);
  const minN = Number(opts.minN ?? 10);

  const rows = await researchRepository.listDriftRows(tenantId);
  const now = Date.now();
  const recentCutoff = now - recentDays * 86400_000;
  const baselineCutoff = now - baselineDays * 86400_000;
  const recent = rows.filter((r) => Date.parse(r.created_at) > recentCutoff);
  const baseline = rows.filter((r) => Date.parse(r.created_at) <= recentCutoff && Date.parse(r.created_at) > baselineCutoff);

  const agg = (arr) => {
    if (arr.length < minN) return null;
    const a = arr.map((r) => Number(r.ai));
    const b = arr.map((r) => Number(r.human));
    return { agreement: adjacentAgreement(a, b), n: arr.length };
  };

  const recentAgg = agg(recent);
  const baselineAgg = agg(baseline);
  const detected = recentAgg && baselineAgg && baselineAgg.agreement - recentAgg.agreement > threshold;

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

async function repeatabilitySummary(tenantId) {
  const rows = await researchRepository.listRepeatabilityRows(tenantId);
  const byHash = new Map();
  for (const r of rows) {
    if (!byHash.has(r.input_hash)) byHash.set(r.input_hash, []);
    byHash.get(r.input_hash).push(Number(r.final_score));
  }
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

async function recordTeacherScoreChange({ runId, finalScore, tenantId, reviewerId, reviewNote }) {
  const { markHumanReviewed } = require("./human-approval");
  if (!runId || finalScore === undefined || finalScore === null) return null;

  const run = await researchRepository.getEvaluationRunScore(runId, tenantId);
  if (!run || run.final_score === undefined || run.final_score === null) return null;
  if (Number(run.final_score) === Number(finalScore)) return null;

  const previous = Number(run.final_score);
  const note = reviewNote ? ` ${reviewNote}` : "";
  const feedback = `Koreksi guru: skor AI ${previous} → manusia ${finalScore}.${note}`.slice(0, 2000);

  await researchRepository.saveHumanScore({
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
