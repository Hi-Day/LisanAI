// Evidence Feedback Loop
//
// Turns the result of an adaptive probe into explicit, auditable assessment
// state. The AI score remains the source of truth; this module does not invent
// a score. It records which evidence came from the original response versus a
// teacher-gated probe and derives a competency state at the Learning Outcome
// level.

const { parseLearningOutcomes, questionOutcomeMap } = require("./harness/learning-outcome-alignment");

function clampScore(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}

function competencyLevel(score, hasEvidence) {
  if (!hasEvidence) return "INSUFFICIENT_EVIDENCE";
  if (score >= 85) return "MASTERED";
  if (score >= 70) return "DEVELOPING";
  return "NEEDS_SUPPORT";
}

function probeDecision(probing) {
  const status = String(probing?.status || probing?.decision || probing?.gateDecision || "").toLowerCase();
  if (status === "accepted") return "ACCEPTED";
  if (status === "skipped") return "SKIPPED";
  if (status === "terminated") return "TERMINATED";
  if (probing?.answer && String(probing.answer).trim()) return "ACCEPTED";
  return null;
}

function buildQuestionFeedback(question, questionScore, index) {
  const probing = questionScore?.probing || null;
  const hasProbeAnswer = Boolean(String(probing?.answer || "").trim());
  const hasInitialEvidence = Array.isArray(questionScore?.evidence)
    ? questionScore.evidence.length > 0
    : Boolean(String(questionScore?.answer || "").trim());
  const hasAdditionalEvidence = hasProbeAnswer;
  const finalScore = clampScore(questionScore?.score);

  if (!probing) {
    return {
      questionIndex: index,
      probingUsed: false,
      evidence: {
        original: { present: hasInitialEvidence },
        probe: null,
      },
      score: {
        beforeProbing: null,
        verifiedAfterProbing: finalScore,
        delta: null,
        state: "VERIFIED_NO_PROBE",
      },
    };
  }

  return {
    questionIndex: index,
    probingUsed: true,
    probeDecision: probeDecision(probing),
    gateId: probing.gateId || null,
    teacherDecisionNote: probing.decisionNote || probing.teacherNote || null,
    evidence: {
      original: {
        present: hasInitialEvidence,
        source: "student_answer",
      },
      probe: {
        present: hasAdditionalEvidence,
        source: hasAdditionalEvidence ? "adaptive_probe_answer" : null,
        prompt: probing.approvedPrompt || probing.prompt || null,
        answer: hasAdditionalEvidence ? String(probing.answer).trim() : null,
        evidenceGap: probing.evidenceGap || null,
      },
    },
    score: {
      // A true pre-probe score is intentionally null until the system performs
      // a separate baseline evaluation. Never manufacture one from the final
      // score. The current score is explicitly marked as post-probe verified.
      beforeProbing: Number.isFinite(Number(probing.baselineScore)) ? clampScore(probing.baselineScore) : null,
      verifiedAfterProbing: finalScore,
      delta: Number.isFinite(Number(probing.baselineScore))
        ? finalScore - clampScore(probing.baselineScore)
        : null,
      state: hasAdditionalEvidence ? "VERIFIED_WITH_ADDITIONAL_EVIDENCE" : "VERIFIED_AFTER_PROBE_DECISION",
    },
  };
}

function deriveCompetencyState(assessment, questionScores) {
  const questions = Array.isArray(assessment?.questions) ? assessment.questions : [];
  const outcomes = parseLearningOutcomes(assessment?.outcomes ?? assessment?.learningOutcomes ?? assessment?.learningOutcome);
  const byQuestion = questionOutcomeMap(questions, outcomes);
  const groups = new Map();

  (questionScores || []).forEach((qs, index) => {
    const lo = byQuestion.get(index);
    if (!lo) return;
    if (!groups.has(lo.id)) groups.set(lo.id, { id: lo.id, text: lo.text, scores: [], evidenceCount: 0, probeCount: 0 });
    const group = groups.get(lo.id);
    group.scores.push(clampScore(qs?.score));
    const probe = qs?.probing;
    if (Array.isArray(qs?.evidence) && qs.evidence.length) group.evidenceCount += qs.evidence.length;
    if (String(probe?.answer || "").trim()) {
      group.evidenceCount += 1;
      group.probeCount += 1;
    }
  });

  return [...groups.values()].map((group) => {
    const average = group.scores.length
      ? Math.round(group.scores.reduce((sum, score) => sum + score, 0) / group.scores.length)
      : 0;
    return {
      learningOutcomeId: group.id,
      learningOutcome: group.text,
      score: average,
      level: competencyLevel(average, group.evidenceCount > 0),
      evidenceCount: group.evidenceCount,
      probingCount: group.probeCount,
      updatedBy: group.probeCount > 0 ? "assessment_plus_adaptive_probing" : "assessment",
    };
  });
}

function applyEvidenceFeedbackLoop(submission, assessment) {
  const safe = submission || {};
  const questionScores = Array.isArray(safe.questionScores) ? safe.questionScores : [];
  const questions = Array.isArray(assessment?.questions) ? assessment.questions : [];
  const questionFeedback = questionScores.map((qs, index) => buildQuestionFeedback(questions[index], qs, index));
  const probeCount = questionFeedback.filter((item) => item.probingUsed).length;
  const additionalEvidenceCount = questionFeedback.filter((item) => item.evidence?.probe?.present).length;

  return {
    ...safe,
    evidenceFeedback: {
      version: 1,
      mode: "post_probe_verification",
      probeCount,
      additionalEvidenceCount,
      questions: questionFeedback,
      generatedAt: new Date().toISOString(),
    },
    competencyState: deriveCompetencyState(assessment, questionScores),
    scoreState: probeCount > 0 ? "VERIFIED_AFTER_ADAPTIVE_PROBING" : "VERIFIED",
  };
}

module.exports = {
  applyEvidenceFeedbackLoop,
  buildQuestionFeedback,
  deriveCompetencyState,
  competencyLevel,
};
