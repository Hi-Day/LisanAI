const { createHarness } = require("./index");
const { MockProvider } = require("../ai/mock-provider");
const { OpenRouterProvider } = require("../ai/openrouter-provider");
const { parse } = require("../ai/response-parser");
const { persistEvaluationTrace } = require("../evaluation/trace-persister");
const { parseRubricText } = require("./plugins/rubric");

/**
 * Evaluate assessment answers through the Assessment Harness.
 *
 * Preserves the existing frontend contract of `evaluateAnswers`:
 *   { finalScore, feedback, questionScores:[...] }
 * but now also attaches harness provenance (evaluationRunId, criteria, trace).
 *
 * Set HARNESS_EVALUATION=true to route evaluation through the harness.
 * Set HARNESS_PROVIDER=mock|openrouter to pick the provider (default mock
 * when no API key).
 */
async function evaluateWithHarness(payload) {
  const harness = createHarness(payload.harnessConfig || {});
  const provider =
    process.env.HARNESS_PROVIDER === "openrouter"
      ? new OpenRouterProvider()
      : new MockProvider();
  harness.setProvider(provider).setParser({ parse });
  harness.setTracePersister(persistEvaluationTrace);

  const assessment = payload.assessment || {};
  const questions = Array.isArray(assessment.questions) ? assessment.questions : [];
  const answers = Array.isArray(payload.answers) ? payload.answers : [];

  // Build a structured rubric from the assessment (server-side, never client).
  const rubric = structuredRubric(payload, assessment, questions.length);

  const result = await harness.evaluate({
    assessmentId: assessment.id || payload.assessmentId,
    assessment,
    rubric,
    answers,
    studentName: payload.studentName,
    tenantId: payload.tenantId || (payload.auth && payload.auth.tenant && payload.auth.tenant.id),
    userId: payload.userId || (payload.auth && payload.auth.user && payload.auth.user.id),
    meta: {
      route: "harness",
      source: "assessment-api",
    },
  });

  // Adapt harness canonical output to the existing frontend contract.
  // The frontend contract is PER-QUESTION: exactly one entry per student answer.
  //
  // Question ↔ Criterion mapping (P0): a question maps to a SUBSET of rubric
  // criteria (partial applicability — e.g. 2 of 3 criteria apply to one
  // question). Criterion evaluations are atomic and tied to an answer
  // (answerIndex). A question's score is the weighted aggregate of the criteria
  // applicable to it (weights renormalized within the subset). The overall
  // finalScore remains the deterministic weighted aggregate over all criteria.
  const criteria = result.criteria || [];
  const verification = result.verification || {};
  const status = verification.status;

  // PRD FR-08 / FR-13 — Verification gate enforced at the API boundary so a
  // failed evaluation is never surfaced as a final student score.
  //   PASS   → returned normally.
  //   REVIEW → returned but flagged for human review (not auto-published).
  //   FAIL   → blocked; the student must not see a final score.
  if (status === "FAIL") {
    const error = new Error(
      "Evaluasi belum dapat diselesaikan karena verifikasi gagal. Silakan coba lagi atau hubungi guru."
    );
    error.status = 422;
    error.verification = verification;
    throw error;
  }

  const questionScores = buildQuestionScores(questions, answers, criteria, rubric);

  // Question ↔ Rubrik alignment: skor akhir hanya dihitung dari kriteria yang
  // benar-benar diukur oleh soal (deterministik, server-side). Tanpa mapping
  // apa pun, memakai agregat mentah harness (perilaku lama).
  const { computeFinalScore } = require("../evaluation/scoring");
  let aligned;
  try {
    aligned = calculateAlignedFinalScore(criteria, rubric, questions);
  } catch (alignErr) {
    // Alignment error is non-fatal — fall back to deterministic computeFinalScore
    // on the full criteria set. Never silently fall back to model-provided score.
    console.error("calculateAlignedFinalScore failed, using computeFinalScore rescue:", alignErr.message);
    aligned = null;
  }
  const rescueScore =
    aligned
      ? aligned.finalScore
      : computeFinalScore({ criteria, rubric }).finalScore;
  return {
    finalScore: rescueScore,
    feedback: result.feedback || `Evaluasi lisan selesai. Skor akhir ${rescueScore} dari 100.`,
    questionScores,
    published: result.published !== false && status !== "FAIL",
    requiresHumanReview: status === "REVIEW" || result.requiresHumanReview === true,
    // New harness provenance (extra fields; frontend ignores unknown keys).
    evaluationRunId: result.evaluationRunId,
    evaluationId: result.evaluationId,
    criteria: result.criteria,
    verification,
    versioning: result.versioning,
    reliability: result.reliability,
    rubricAlignment:
      aligned && aligned.excludedCriterionIds.length > 0
        ? { active: true, excludedCriterionIds: aligned.excludedCriterionIds }
        : null,
  };
}

function clamp01(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return 0;
  return Math.max(0, Math.min(100, s));
}

/**
 * Build the per-question frontend contract from atomic criterion evaluations.
 *
 * Each criterion evaluation carries an `answerIndex` (which student answer it
 * judged). A question's applicable criteria are those whose answerIndex matches
 * the question's index. If a criterion has no answerIndex, it is treated as
 * applicable to every question (assessment-level criterion).
 *
 * Question ↔ Rubric alignment (P0): a question MAY declare which rubric
 * criteria it actually measures (question.criteria = [{id,name}], stamped at
 * generation time by enforceRubricAlignment). When present, only the matching
 * criteria are used to score that question — a "sebutkan" question is never
 * penalized for criteria the question never asked (sebab-akibat, penerapan,
 * dst). Questions without a mapping keep the legacy "all criteria apply"
 * behavior.
 *
 * Partial applicability: weights are renormalized within the applicable subset
 * so the result stays on the 0–100 scale.
 */
function buildQuestionScores(questions, answers, criteria, rubric) {
  const n = answers.length;
  const byAnswer = new Map();
  for (const c of criteria || []) {
    const key = Number.isInteger(c.answerIndex) ? c.answerIndex : "all";
    if (!byAnswer.has(key)) byAnswer.set(key, []);
    byAnswer.get(key).push(c);
  }
  const allCriteria = byAnswer.get("all") || [];
  return Array.from({ length: n }, (_, idx) => {
    const explicit = byAnswer.get(idx) || [];
    const declaredKeys = questionCriterionKeys(questions[idx], rubric);
    let applicable;
    if (declaredKeys && declaredKeys.length > 0) {
      // Aligned: only criteria the question actually asks about. Fall back to
      // all criteria only when NONE of the declared keys match anything
      // (protects against a broken mapping silently zeroing a question).
      const matched = allCriteria.filter((c) => criterionMatches(c, declaredKeys));
      applicable = [...explicit, ...(matched.length > 0 ? matched : allCriteria)];
    } else {
      applicable = [...explicit, ...allCriteria];
    }
    // Evaluasi kriterial dari model biasanya tidak membawa weight; bobot
    // diambil dari rubrik supaya skor per soal konsisten dgn skor akhir
    // (weight di-renormalisasi di dalam aggregateScore).
    applicable = applicable.map((c) => withRubricWeight(c, rubric));
    const strengths = [];
    const gaps = [];
    const matched = [];
    for (const c of applicable) {
      // Prefer the model's explicitly-authored strengths/gaps; fall back to
      // keyword classification of the rationale when they are absent.
      if (Array.isArray(c.strengths) && c.strengths.length) {
        strengths.push(...c.strengths.map(String).filter(Boolean));
      }
      if (Array.isArray(c.gaps) && c.gaps.length) {
        gaps.push(...c.gaps.map(String).filter(Boolean));
      }
      if ((!Array.isArray(c.strengths) || !c.strengths.length) && (!Array.isArray(c.gaps) || !c.gaps.length)) {
        const { strengths: s, gaps: g } = splitFeedback(c.rationale, c.score);
        strengths.push(...s);
        gaps.push(...g);
      }
      matched.push(...(c.evidence || []).map((ev) => ev.text));
    }
    return {
      question: (questions[idx] && questions[idx].prompt) || `Soal ${idx + 1}`,
      answer: answers[idx] || "",
      score: aggregateScore(applicable),
      matched,
      strengths: [...new Set(strengths)],
      gaps: [...new Set(gaps)],
      criterionIds: applicable.map((c) => c.criterionId),
      confidence: averageConfidence(applicable),
    };
  });
}

/**
 * Normalized keys a question declares for its rubric criteria.
 * Returns null when the question has no explicit mapping (legacy behavior:
 * every criterion applies). Accepts strings or {id,name} objects.
 */
function questionCriterionKeys(question, rubric) {
  const raw = (question && question.criteria) || [];
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const keys = [];
  for (const v of raw) {
    if (typeof v === "string") keys.push(normKey(v));
    else if (v && typeof v === "object") keys.push(normKey(v.id || v.name || v.criterionId || ""));
  }
  return keys.filter(Boolean);
}

function normKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Whether a criterion evaluation (criterionId/label) belongs to one of the
 * declared alignment keys. Weight suffixes like "40" or "40%" in a declared
 * name ("Ketepatan konsep 40%") are tolerated.
 */
function criterionMatches(criterion, keys) {
  const idKey = normKey(criterion.criterionId || "");
  const labelKey = normKey(criterion.label || criterion.name || "");
  const stripWeight = (k) => k.replace(/\s\d+$/, "").replace(/%/g, "").trim();
  return keys.some((k) => {
    const ks = stripWeight(k) || k;
    return (
      (idKey && (idKey === ks || idKey.includes(ks) || ks.includes(idKey))) ||
      (labelKey && (labelKey === ks || labelKey.includes(ks) || ks.includes(labelKey)))
    );
  });
}

/**
 * Attach the rubric weight to a criterion evaluation when the model did not
 * provide one (so per-question aggregation matches the weighted final score).
 */
function withRubricWeight(criterion, rubric) {
  if (Number(criterion.weight) > 0) return criterion;
  const def = ((rubric && rubric.criteria) || []).find(
    (c) => normKey(c.id) === normKey(criterion.criterionId)
  );
  if (!def) return criterion;
  return { ...criterion, weight: Number(def.weight || 0) };
}

/**
 * Weighted aggregate of a question's applicable criteria, renormalizing weights
 * within the subset. Falls back to the mean when no weights are available.
 */
function aggregateScore(criteria) {
  const scored = (criteria || []).filter((c) => Number.isFinite(Number(c.score)));
  if (scored.length === 0) return 0;
  const weightSum = scored.reduce((acc, c) => acc + Number(c.weight || 0), 0);
  if (weightSum <= 0) {
    return clamp01(scored.reduce((acc, c) => acc + Number(c.score), 0) / scored.length);
  }
  const weighted = scored.reduce((acc, c) => acc + Number(c.score) * (Number(c.weight) / weightSum), 0);
  return clamp01(weighted);
}

/** Average confidence across a question's applicable criteria (0 when none). */
function averageConfidence(criteria) {
  const confs = (criteria || []).map((c) => Number(c.confidence)).filter((v) => Number.isFinite(v));
  if (confs.length === 0) return 0;
  return confs.reduce((a, b) => a + b, 0) / confs.length;
}

/**
 * Deterministic final score that respects question ↔ rubric alignment.
 *
 * When at least one question declares which rubric criteria it measures, any
 * criterion that NO question actually asks about is excluded and the remaining
 * weights are renormalized — a "sebutkan" soal is never dragged down by a
 * "sebab-akibat" criterion that no question tested.
 *
 * Returns null (legacy behavior: raw aggregate over all criteria) when no
 * question carries an explicit mapping.
 */
function calculateAlignedFinalScore(criteria, rubric, questions) {
  const mappedKeys = new Set();
  let hasMapping = false;
  for (const q of questions || []) {
    const keys = questionCriterionKeys(q, rubric);
    if (!keys || keys.length === 0) continue;
    hasMapping = true;
    keys.forEach((k) => mappedKeys.add(k));
  }
  if (!hasMapping) return null;

  const keyList = [...mappedKeys];
  const keptCriteria = (criteria || []).filter((c) => criterionMatches(c, keyList));
  const keptIds = new Set(keptCriteria.map((c) => normKey(c.criterionId)));
  const keptRubricCriteria = ((rubric && rubric.criteria) || []).filter((c) => keptIds.has(normKey(c.id)));
  if (keptCriteria.length === 0 || keptRubricCriteria.length === 0) return null;

  // Renormalize weights over the effective (kept) criteria subset.
  const totalWeight = keptRubricCriteria.reduce((acc, c) => acc + Number(c.weight || 0), 0);
  const weightedRubric = {
    ...rubric,
    criteria:
      totalWeight > 0
        ? keptRubricCriteria.map((c) => ({ ...c, weight: (Number(c.weight) || 0) / totalWeight }))
        : keptRubricCriteria,
  };
  try {
    const { calculateFinalScore } = require("../evaluation/scoring");
    const weighted = calculateFinalScore(keptCriteria, weightedRubric);
    return {
      finalScore: Math.round(weighted.finalScore),
      excludedCriterionIds: ((rubric && rubric.criteria) || [])
        .map((c) => c.id)
        .filter((id) => !keptIds.has(normKey(id))),
    };
  } catch (err) {
    // Never silently fall back to model-provided finalScore. A rubric error is
    // a server-side fault that must be surfaced, not masked.
    console.error("calculateAlignedFinalScore gagal:", err);
    throw err;
  }
}

/**
 * Build a structured rubric from the server-side assessment payload.
 * Falls back to a uniform weighted rubric across the question count.
 */
function structuredRubric(payload, assessment, questionCount) {
  // 1. Explicit structured rubric on the assessment payload.
  const structured = assessment.rubric;
  if (structured && Array.isArray(structured.criteria) && structured.criteria.length > 0) {
    return normalizeWeights(structured);
  }
  // 2. Free-text rubric (e.g. "Akurasi 40%, Kelengkapan 60%").
  if (typeof structured === "string" && structured.trim()) {
    const criteria = parseRubricText(structured);
    if (criteria.length > 0) return { id: "rubric-assess", criteria };
  }
  // 3. Uniform per-question criteria.
  const n = Math.max(1, (Array.isArray(payload.answers) ? payload.answers.length : 1));
  return {
    id: "rubric-uniform",
    criteria: Array.from({ length: n }, (_, i) => ({
      id: `q${i + 1}`,
      name: `Soal ${i + 1}`,
      weight: 1 / n,
      scale: 100,
    })),
  };
}

function normalizeWeights(rubric) {
  const sum = rubric.criteria.reduce((acc, c) => acc + Number(c.weight || 0), 0);
  const criteria =
    sum <= 0
      ? rubric.criteria
      : rubric.criteria.map((c) => ({ ...c, weight: (Number(c.weight) || 0) / sum }));
  return { ...rubric, criteria };
}

function splitSentences(rationale) {
  if (!rationale) return [];
  return String(rationale)
    .split(/[.;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 3);
}

// Keywords that signal a critique / shortcoming rather than a strength.
const GAP_KEYWORDS = [
  "tidak", "belum", "kurang", "tidak ada", "tidak menyebut", "tidak relevan",
  "kurangnya", "seharusnya", "sebaiknya", "perlu", "lemah", "hilang",
  "tidak lengkap", "tidak sesuai", "tidak menjelaskan", "tidak mencakup",
  "tidak menyertakan", "tidak menggunakan", "tidak menunjukkan",
  "missing", "lacks", "lacking", "should", "needs", "weak", "absent",
  "does not", "did not", "not relevant", "not mention", "not include",
  "not explain", "not cover", "not use", "not show", "incomplete",
];

// Keywords that signal a strength / positive observation.
const STRENGTH_KEYWORDS = [
  "benar", "tepat", "akurat", "relevan", "sesuai", "lengkap", "jelas",
  "baik", "memadai", "cukup", "mampu", "berhasil", "memahami", "menguasai",
  "menyebut", "menjelaskan", "mencakup", "menggunakan", "menunjukkan",
  "mengidentifikasi", "memberikan", "mengenali", "memperlihatkan",
  "correct", "correctly", "accurate", "relevant", "appropriate", "complete",
  "clear", "adequate", "properly", "successfully", "understands", "identifies",
  "mentions", "explains", "covers", "uses", "shows", "gives", "provides",
  "recognizes", "demonstrates", "good", "well",
];

/**
 * Split a criterion's rationale into strengths vs gaps.
 * A sentence is classified by keywords first: a critique keyword routes it to
 * gaps, a strength keyword routes it to strengths. Only neutral sentences fall
 * back to the low-score (< 70) rule, so a low score never wipes out genuine
 * strengths that the model explicitly praised.
 */
function splitFeedback(rationale, score) {
  const sentences = splitSentences(rationale);
  const strengths = [];
  const gaps = [];
  const lowScore = Number(score) < 70;
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    const isCritique = GAP_KEYWORDS.some((kw) => lower.includes(kw));
    const isStrength = STRENGTH_KEYWORDS.some((kw) => lower.includes(kw));
    if (isCritique) gaps.push(sentence);
    else if (isStrength) strengths.push(sentence);
    else if (lowScore) gaps.push(sentence);
    else strengths.push(sentence);
  }
  return { strengths, gaps };
}

module.exports = {
  evaluateWithHarness,
  structuredRubric,
  normalizeWeights,
  splitFeedback,
  buildQuestionScores,
  aggregateScore,
  averageConfidence,
  calculateAlignedFinalScore,
  questionCriterionKeys,
  criterionMatches,
};