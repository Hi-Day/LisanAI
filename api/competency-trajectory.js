const { getDb } = require("../server/database");
const { getSessionUser, SESSION_COOKIE } = require("../server/auth-service");
const { parseCookies, sendJson } = require("../server/http-utils");
const { buildCompetencyTrajectory } = require("../server/competency-trajectory");
const { parseLearningOutcomes, questionOutcomeMap } = require("../server/harness/learning-outcome-alignment");
const { ensureDatabase } = require("../server/bootstrap");

function parsePayload(value) {
  try { return JSON.parse(value || "{}"); } catch { return {}; }
}

function evidenceCoverage(submission, questionScores) {
  const explicit = Number(submission?.evidenceQuality?.overallCoverage ?? submission?.evidenceCoverage);
  if (Number.isFinite(explicit)) return Math.max(0, Math.min(1, explicit));
  const total = questionScores.length;
  if (!total) return 0;
  const withEvidence = questionScores.filter((qs) =>
    (Array.isArray(qs?.evidence) && qs.evidence.length > 0) ||
    String(qs?.answer || "").trim() ||
    String(qs?.probing?.answer || "").trim()
  ).length;
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
      if (String(qs?.probing?.answer || "").trim()) {
        bucket.evidenceCount += 1;
        bucket.probingCount += 1;
      }
      groups.set(lo.id, bucket);
    });

    groups.forEach((group) => {
      records.push({
        learningOutcomeId: group.learningOutcomeId,
        learningOutcome: group.learningOutcome,
        assessmentId: submission.assessmentId || row.assessment_id,
        submittedAt: submission.submittedAt || row.submitted_at,
        score: Math.round(group.scores.reduce((sum, value) => sum + value, 0) / group.scores.length),
        evidenceCoverage: evidenceCoverage(submission, scores),
        evidenceCount: group.evidenceCount,
        probingCount: group.probingCount,
        evidenceGain: Number(submission?.evidenceQuality?.impact?.evidenceGain || 0) || 0,
      });
    });
  }

  return records;
}

module.exports = async (req, res) => {
  try {
    await ensureDatabase();
    if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
    const auth = await getSessionUser(parseCookies(req)[SESSION_COOKIE]);
    if (!auth) return sendJson(res, 401, { error: "Unauthorized" });

    const db = getDb();
    const assessmentRows = await db.all(
      "SELECT id, class_id, teacher_id, payload FROM assessments WHERE tenant_id = ?",
      auth.tenant.id
    );
    const assessments = assessmentRows.map((row) => ({ ...row, payload: parsePayload(row.payload) }));
    const allowedAssessmentIds = new Set();

    if (auth.user.role === "student") {
      const rows = await db.all(
        "SELECT * FROM submissions WHERE tenant_id = ? AND user_id = ? ORDER BY submitted_at ASC",
        auth.tenant.id,
        auth.user.id
      );
      rows.forEach((row) => allowedAssessmentIds.add(row.assessment_id));
      const scoped = assessments.filter((item) => allowedAssessmentIds.has(item.id));
      return sendJson(res, 200, { trajectory: buildCompetencyTrajectory(buildRecords(rows, scoped)) });
    }

    const rows = await db.all(
      auth.user.role === "teacher"
        ? `SELECT s.* FROM submissions s JOIN assessments a ON a.id = s.assessment_id
           WHERE s.tenant_id = ? AND a.tenant_id = ? AND a.teacher_id = ? ORDER BY s.submitted_at ASC`
        : "SELECT * FROM submissions WHERE tenant_id = ? ORDER BY submitted_at ASC",
      ...(auth.user.role === "teacher"
        ? [auth.tenant.id, auth.tenant.id, auth.user.id]
        : [auth.tenant.id])
    );
    rows.forEach((row) => allowedAssessmentIds.add(row.assessment_id));
    const scoped = assessments.filter((item) => allowedAssessmentIds.has(item.id));
    return sendJson(res, 200, { trajectory: buildCompetencyTrajectory(buildRecords(rows, scoped)) });
  } catch (error) {
    console.error("[competency-trajectory]", error);
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};
