const { parseLearningOutcomes, questionOutcomeMap } = require("../harness/learning-outcome-alignment");
const { buildCompetencyTrajectory } = require("../competency-trajectory");
const competencyRepository = require("../database/competency-repository");

function parsePayload(value) {
  try { return JSON.parse(value || "{}"); } catch { return {}; }
}

function evidenceCoverage(submission, questionScores) {
  const explicit = Number(submission?.evidenceQuality?.overallCoverage ?? submission?.evidenceCoverage);
  if (Number.isFinite(explicit)) return Math.max(0, Math.min(1, explicit));
  const total = questionScores.length;
  if (!total) return 0;
  const withEvidence = questionScores.filter((qs) => (Array.isArray(qs?.evidence) && qs.evidence.length > 0) || String(qs?.answer || "").trim() || String(qs?.probing?.answer || "").trim()).length;
  return withEvidence / total;
}

function buildRecords(rows, assessments) {
  const assessmentMap = new Map(assessments.map((item) => [item.id, item.payload]));
  const records = [];
  for (const row of rows) {
    const submission = parsePayload(row.payload);
    const assessment = assessmentMap.get(row.assessment_id);
    if (!assessment) continue;
    const outcomes = parseLearningOutcomes(assessment.outcomes ?? assessment.learningOutcomes ?? assessment.learningOutcome);
    const questionMap = questionOutcomeMap(assessment.questions || [], outcomes);
    const scores = Array.isArray(submission.questionScores) ? submission.questionScores : [];
    const groups = new Map();
    scores.forEach((qs, index) => {
      const lo = questionMap.get(index);
      const score = Number(qs?.score);
      if (!lo || !Number.isFinite(score)) return;
      const bucket = groups.get(lo.id) || { learningOutcomeId: lo.id, learningOutcome: lo.text, scores: [], evidenceCount: 0, probingCount: 0 };
      bucket.scores.push(Math.max(0, Math.min(100, score)));
      bucket.evidenceCount += Array.isArray(qs?.evidence) ? qs.evidence.length : 0;
      if (String(qs?.probing?.answer || "").trim()) { bucket.evidenceCount += 1; bucket.probingCount += 1; }
      groups.set(lo.id, bucket);
    });
    groups.forEach((group) => records.push({
      learningOutcomeId: group.learningOutcomeId,
      learningOutcome: group.learningOutcome,
      assessmentId: submission.assessmentId || row.assessment_id,
      submittedAt: submission.submittedAt || row.submitted_at,
      score: Math.round(group.scores.reduce((sum, value) => sum + value, 0) / group.scores.length),
      evidenceCoverage: evidenceCoverage(submission, scores),
      evidenceCount: group.evidenceCount,
      probingCount: group.probingCount,
      evidenceGain: Number(submission?.evidenceQuality?.impact?.evidenceGain || 0) || 0,
    }));
  }
  return records;
}

async function execute(auth) {
  const assessmentRows = await competencyRepository.listAssessments(auth.tenant.id);
  const assessments = assessmentRows.map((row) => ({ ...row, payload: parsePayload(row.payload) }));
  const rows = auth.user.role === "student"
    ? await competencyRepository.listStudentSubmissions(auth.tenant.id, auth.user.id)
    : auth.user.role === "teacher"
      ? await competencyRepository.listTeacherSubmissions(auth.tenant.id, auth.user.id)
      : await competencyRepository.listTenantSubmissions(auth.tenant.id);
  const allowed = new Set(rows.map((row) => row.assessment_id));
  const scoped = assessments.filter((item) => allowed.has(item.id));
  return buildCompetencyTrajectory(buildRecords(rows, scoped));
}

module.exports = { execute, buildRecords, evidenceCoverage };
