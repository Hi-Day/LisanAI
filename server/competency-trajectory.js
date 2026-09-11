/**
 * Longitudinal competency trajectory engine.
 * Learning Outcome is the primary unit; criteria remain supporting evidence.
 */

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value) {
  const n = toNumber(value);
  return n == null ? null : Math.max(0, Math.min(100, n));
}

function level(score, evidenceCoverage = null) {
  if (score == null) return "INSUFFICIENT_EVIDENCE";
  if (evidenceCoverage != null && evidenceCoverage < 0.5) return "INSUFFICIENT_EVIDENCE";
  if (score >= 85) return "MASTERED";
  if (score >= 70) return "DEVELOPING";
  return "NEEDS_SUPPORT";
}

function normalizeSnapshot(snapshot, index = 0) {
  const score = clamp(snapshot?.score ?? snapshot?.averageScore ?? snapshot?.verifiedScore);
  const coverage = toNumber(snapshot?.evidenceCoverage);
  return {
    index,
    assessmentId: snapshot?.assessmentId || snapshot?.id || null,
    submittedAt: snapshot?.submittedAt || snapshot?.completedAt || snapshot?.createdAt || null,
    score,
    evidenceCoverage: coverage == null ? null : Math.max(0, Math.min(1, coverage)),
    evidenceGain: toNumber(snapshot?.evidenceGain) ?? 0,
    probingCount: toNumber(snapshot?.probingCount) ?? 0,
    evidenceCount: toNumber(snapshot?.evidenceCount) ?? 0,
  };
}

function trendForSnapshots(snapshots) {
  if (!snapshots.length) return { direction: "NO_DATA", delta: null, slope: null };
  const scored = snapshots.filter((s) => s.score != null);
  if (scored.length < 2) return { direction: "BASELINE", delta: null, slope: null };
  const first = scored[0].score;
  const last = scored[scored.length - 1].score;
  const delta = last - first;
  const slope = delta / Math.max(1, scored.length - 1);
  const direction = delta >= 5 ? "IMPROVING" : delta <= -5 ? "DECLINING" : "STABLE";
  return { direction, delta, slope: Number(slope.toFixed(2)) };
}

function buildLearningOutcomeTrajectory(learningOutcomeId, learningOutcome, snapshots = []) {
  const normalized = snapshots.map(normalizeSnapshot).sort((a, b) => {
    const ta = a.submittedAt ? Date.parse(a.submittedAt) : a.index;
    const tb = b.submittedAt ? Date.parse(b.submittedAt) : b.index;
    return ta - tb;
  });
  const latest = normalized.at(-1) || null;
  const trend = trendForSnapshots(normalized);
  return {
    learningOutcomeId,
    learningOutcome,
    snapshotCount: normalized.length,
    history: normalized,
    latest: latest ? {
      score: latest.score,
      evidenceCoverage: latest.evidenceCoverage,
      level: level(latest.score, latest.evidenceCoverage),
      probingCount: latest.probingCount,
      evidenceCount: latest.evidenceCount,
    } : null,
    trend,
    interpretation: trend.direction === "IMPROVING"
      ? "Kompetensi menunjukkan peningkatan pada beberapa assessment terakhir."
      : trend.direction === "DECLINING"
        ? "Kompetensi menunjukkan penurunan; perlu ditinjau evidence dan strategi pembelajaran."
        : trend.direction === "STABLE"
          ? "Kompetensi relatif stabil pada assessment yang tersedia."
          : trend.direction === "BASELINE"
            ? "Belum cukup assessment untuk menentukan arah trajectory."
            : "Belum tersedia data trajectory.",
  };
}

function buildCompetencyTrajectory(records = []) {
  const groups = new Map();
  for (const record of records) {
    const loId = record?.learningOutcomeId || record?.outcomeId;
    if (!loId) continue;
    if (!groups.has(loId)) groups.set(loId, {
      id: loId,
      text: record.learningOutcome || record.outcomeText || loId,
      snapshots: [],
    });
    groups.get(loId).snapshots.push(record);
  }
  return [...groups.values()].map((group) =>
    buildLearningOutcomeTrajectory(group.id, group.text, group.snapshots)
  );
}

module.exports = {
  buildCompetencyTrajectory,
  buildLearningOutcomeTrajectory,
  level,
  normalizeSnapshot,
  trendForSnapshots,
};
