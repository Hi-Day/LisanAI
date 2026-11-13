/**
 * Score release policy.
 *
 * Official submissions created by evaluation start with scoreRelease.status = "pending".
 * Until a lecturer validates them, students receive feedback without any score:
 * the student view is built from a whitelist so new score-bearing fields stay hidden
 * by default. Submissions created before this policy (no scoreRelease field) are
 * treated as released so existing results do not disappear.
 */

const PENDING = "pending";
const RELEASED = "released";

function isScoreReleased(submission) {
  return !submission || !submission.scoreRelease || submission.scoreRelease.status === RELEASED;
}

function pendingRelease() {
  return { status: PENDING };
}

function releasedBy(reviewerId, at = new Date().toISOString()) {
  return { status: RELEASED, validatedBy: reviewerId || null, validatedAt: at };
}

// A sentence that pairs a score word with a number (e.g. "Skor akhir 82 dari 100.") would leak the score.
const SCORE_SENTENCE = /[^.!?\n]*(?:skor|nilai|score|poin|point|\/\s*100|dari\s+100)[^.!?\n]*\d[^.!?\n]*[.!?]?|[^.!?\n]*\d[^.!?\n]*(?:skor|nilai|score|poin|point|\/\s*100|dari\s+100)[^.!?\n]*[.!?]?/gi;

function stripScoreMentions(text) {
  if (typeof text !== "string") return text;
  return text.replace(SCORE_SENTENCE, "").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function stripList(items) {
  return Array.isArray(items) ? items.map(stripScoreMentions).filter((item) => typeof item === "string" && item.trim()) : [];
}

function studentQuestionView(item) {
  if (!item || typeof item !== "object") return item;
  const view = {
    question: item.question,
    answer: item.answer,
    matched: Array.isArray(item.matched) ? item.matched : [],
    strengths: stripList(item.strengths),
    gaps: stripList(item.gaps),
    unanswered: Boolean(item.unanswered),
  };
  if (item.hasAudio) view.hasAudio = true;
  if (item.duration !== undefined) view.duration = item.duration;
  if (item.probing && typeof item.probing === "object") {
    view.probing = { prompt: item.probing.prompt, answer: item.probing.answer };
    if (item.probing.hasAudio || item.probing.audio) view.probing.hasAudio = true;
  }
  return view;
}

/** Student-facing copy of a submission; unchanged once the score is released. */
function toStudentView(submission) {
  if (isScoreReleased(submission)) return submission;
  return {
    id: submission.id,
    assessmentId: submission.assessmentId,
    assessmentTitle: submission.assessmentTitle,
    classId: submission.classId || null,
    studentName: submission.studentName,
    submittedAt: submission.submittedAt,
    status: submission.status,
    evaluationSource: submission.evaluationSource,
    feedback: stripScoreMentions(submission.feedback || ""),
    questionScores: Array.isArray(submission.questionScores) ? submission.questionScores.map(studentQuestionView) : [],
    scoreRelease: { status: PENDING },
    ...(submission.alreadyFinalized ? { alreadyFinalized: true } : {}),
  };
}

module.exports = { PENDING, RELEASED, isScoreReleased, pendingRelease, releasedBy, stripScoreMentions, toStudentView };
