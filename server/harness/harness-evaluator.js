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
  const questionScores = buildQuestionScores(questions, answers, criteria);

  return {
    finalScore: Math.round(result.finalScore),
    feedback: result.feedback || `Evaluasi lisan selesai. Skor akhir ${Math.round(result.finalScore)} dari 100.`,
    questionScores,
    // New harness provenance (extra fields; frontend ignores unknown keys).
    evaluationRunId: result.evaluationRunId,
    evaluationId: result.evaluationId,
    criteria: result.criteria,
    verification: result.verification,
    versioning: result.versioning,
    reliability: result.reliability,
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
 * Partial applicability: a question may map to only a subset of criteria. The
 * question score is the weighted aggregate over its applicable criteria, with
 * weights renormalized within the subset so the result stays on the 0–100 scale.
 */
function buildQuestionScores(questions, answers, criteria) {
  const n = answers.length;
  const byAnswer = new Map();
  for (const c of criteria || []) {
    const key = Number.isInteger(c.answerIndex) ? c.answerIndex : "all";
    if (!byAnswer.has(key)) byAnswer.set(key, []);
    byAnswer.get(key).push(c);
  }
  return Array.from({ length: n }, (_, idx) => {
    const applicable = [...(byAnswer.get(idx) || []), ...(byAnswer.get("all") || [])];
    const strengths = [];
    const gaps = [];
    const matched = [];
    for (const c of applicable) {
      const { strengths: s, gaps: g } = splitFeedback(c.rationale, c.score);
      strengths.push(...s);
      gaps.push(...g);
      matched.push(...(c.evidence || []).map((ev) => ev.text));
    }
    return {
      question: (questions[idx] && questions[idx].prompt) || `Soal ${idx + 1}`,
      answer: answers[idx] || "",
      score: aggregateScore(applicable),
      matched,
      strengths,
      gaps,
      criterionIds: applicable.map((c) => c.criterionId),
      confidence: averageConfidence(applicable),
    };
  });
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

module.exports = { evaluateWithHarness, structuredRubric, normalizeWeights, splitFeedback, buildQuestionScores, aggregateScore, averageConfidence };