const { round, clamp } = require("./scoring");
const { structuredRubric } = require("../harness/harness-evaluator");
const { stripScoreMentions } = require("../score-release");

const COMPLAINT_STATUSES = ["pending", "resolved", "rejected"];

function correctionError(message) {
  return Object.assign(new Error(message), { status: 400, code: "INVALID_CORRECTION" });
}

function normKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Weight of each question in the final score, from the rubric weights of the
 * criteria it was scored on. Returns null (caller falls back to equal weights)
 * when any question cannot be mapped to the rubric.
 */
function questionWeights(assessment, questionScores) {
  const scores = Array.isArray(questionScores) ? questionScores : [];
  if (!assessment || !scores.length) return null;
  try {
    const rubric = structuredRubric({ answers: scores }, assessment);
    const raw = scores.map((qs) => {
      const ids = new Set((Array.isArray(qs?.criterionIds) ? qs.criterionIds : []).map(normKey));
      return (rubric.criteria || []).filter((c) => ids.has(normKey(c.id))).reduce((sum, c) => sum + (Number(c.weight) || 0), 0);
    });
    const total = raw.reduce((sum, w) => sum + w, 0);
    return raw.every((w) => w > 0) ? raw.map((w) => w / total) : null;
  } catch {
    return null;
  }
}

/**
 * Apply a lecturer's correction to the stored submission.
 *
 * The stored submission stays the source of truth: only a question's score, gaps
 * and complaint decision are taken from the client. The final score is recomputed
 * here, by moving the stored final score by each question's weighted change, so
 * raising one question can never lower the total and an untouched submission keeps
 * its score exactly.
 */
function applyTeacherCorrection(stored, incoming, weights = null) {
  const previous = Array.isArray(stored?.questionScores) ? stored.questionScores : [];
  const patches = Array.isArray(incoming?.questionScores) ? incoming.questionScores : [];
  const n = previous.length;
  const w = Array.isArray(weights) && weights.length === n ? weights : previous.map(() => 1 / n);

  let delta = 0;
  let changed = false;
  const questionScores = previous.map((item, index) => {
    const patch = patches[index];
    if (!item || !patch || typeof patch !== "object") return item;
    const next = { ...item };
    if (patch.score !== undefined && patch.score !== null && Number(patch.score) !== Number(item.score)) {
      const score = Number(patch.score);
      if (!Number.isFinite(score) || score < 0 || score > 100) throw correctionError(`Skor soal ${index + 1} harus angka 0-100`);
      delta += w[index] * (score - (Number(item.score) || 0));
      next.score = score;
      changed = true;
    }
    if (Array.isArray(patch.gaps)) next.gaps = patch.gaps.slice(0, 20).map((gap) => String(gap).slice(0, 2000));
    // A lecturer decides an existing complaint; the student's reason stays as filed.
    if (item.complaint && patch.complaint && typeof patch.complaint === "object") {
      const status = COMPLAINT_STATUSES.includes(patch.complaint.status) ? patch.complaint.status : item.complaint.status;
      next.complaint = {
        ...item.complaint,
        status,
        ...(patch.complaint.response !== undefined ? { response: String(patch.complaint.response || "").slice(0, 2000) } : {}),
        ...(status !== "pending" ? { resolvedAt: item.complaint.resolvedAt || new Date().toISOString() } : {}),
      };
    }
    return next;
  });

  let finalScore = stored?.finalScore;
  if (changed) {
    const base = Number(stored?.finalScore);
    const recomputed = Number.isFinite(base)
      ? base + delta
      : questionScores.reduce((sum, qs, index) => sum + w[index] * (Number(qs?.score) || 0), 0);
    finalScore = clamp(round(recomputed, 2), 0, 100);
  }
  // The AI's summary may state the old score ("Skor akhir 77 dari 100."); drop that sentence once it is outdated.
  const feedback = changed && typeof stored?.feedback === "string" ? stripScoreMentions(stored.feedback) : stored?.feedback;
  return { ...stored, questionScores, finalScore, feedback };
}

module.exports = { applyTeacherCorrection, questionWeights };
