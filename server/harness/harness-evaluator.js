const { createHarness } = require("./index");
const { MockProvider } = require("../ai/mock-provider");
const { OpenRouterProvider } = require("../ai/openrouter-provider");
const { instrumentProvider } = require("../ai/instrumented-provider");
const { parse } = require("../ai/response-parser");
const { persistEvaluationTrace } = require("../evaluation/trace-persister");
const { parseRubricText } = require("./plugins/rubric");

async function evaluateWithHarness(payload) {
  const harness = createHarness(payload.harnessConfig || {});
  const provider =
    process.env.HARNESS_PROVIDER === "openrouter"
      ? new OpenRouterProvider()
      : new MockProvider();
  const instrumented = instrumentProvider(provider);
  const progress = typeof payload.onProgress === "function" ? payload.onProgress : null;
  const wrapped = progress ? withProgress(instrumented, progress) : instrumented;
  harness.setProvider(wrapped).setParser({ parse });
  harness.setTracePersister(persistEvaluationTrace);

  const assessment = payload.assessment || {};
  const questions = Array.isArray(assessment.questions) ? assessment.questions : [];
  const answers = Array.isArray(payload.answers) ? payload.answers : [];
  const rubric = structuredRubric(payload, assessment, questions.length);

  const result = await harness.evaluate({
    assessmentId: assessment.id || payload.assessmentId,
    assessment,
    rubric,
    answers,
    studentName: payload.studentName,
    tenantId: payload.tenantId || (payload.auth && payload.auth.tenant && payload.auth.tenant.id),
    userId: payload.userId || (payload.auth && payload.auth.user && payload.auth.user.id),
    meta: { route: "harness", source: "assessment-api" },
  });

  const criteriaRaw = result.criteria || [];
  let verification = result.verification || {};
  let status = verification.status;
  const criteria = applyUnansweredDefaults(criteriaRaw, rubric, answers, questions);

  if (status === "FAIL") {
    if (shouldDowngradeToReview(verification, criteria, answers, questions)) {
      verification = { ...verification, status: "REVIEW", downgraded: true };
      status = "REVIEW";
    } else {
      const error = new Error("Evaluasi belum dapat diselesaikan karena verifikasi gagal. Silakan coba lagi atau hubungi guru.");
      error.status = 422;
      error.verification = verification;
      throw error;
    }
  }

  const questionScores = buildQuestionScores(questions, answers, criteria, rubric);
  const { computeFinalScore } = require("../evaluation/scoring");
  let aligned;
  try {
    aligned = calculateAlignedFinalScore(criteria, rubric, questions);
  } catch (alignErr) {
    console.error("calculateAlignedFinalScore failed, using computeFinalScore rescue:", alignErr.message);
    aligned = null;
  }
  const rescueScore = aligned ? aligned.finalScore : computeFinalScore({ criteria, rubric }).finalScore;
  const hasUnanswered = questionScores.some((q) => q.unanswered);
  const finalScore = hasUnanswered
    ? Math.round(questionScores.reduce((s, q) => s + (Number(q.score) || 0), 0) / questionScores.length)
    : rescueScore;

  return {
    finalScore,
    feedback: result.feedback || `Evaluasi lisan selesai. Skor akhir ${finalScore} dari 100.`,
    questionScores,
    published: result.published !== false && status !== "FAIL",
    requiresHumanReview: status === "REVIEW" || result.requiresHumanReview === true,
    evaluationRunId: result.evaluationRunId,
    evaluationId: result.evaluationId,
    criteria: result.criteria,
    verification,
    versioning: result.versioning,
    reliability: result.reliability,
    risk: result.risk,
    rubricAlignment: aligned && aligned.excludedCriterionIds.length > 0
      ? { active: true, excludedCriterionIds: aligned.excludedCriterionIds }
      : null,
  };
}

function clamp01(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return 0;
  return Math.max(0, Math.min(100, s));
}

function withProgress(provider, onProgress) {
  let callSeq = 0;
  return {
    name: provider.name,
    version: provider.version,
    async generate(request) {
      const seq = ++callSeq;
      const label = seq === 1 ? "menilai jawaban Anda" : "memverifikasi & memeriksa ulang";
      onProgress(`Asesor AI sedang ${label}...`);
      const started = Date.now();
      try {
        const raw = await provider.generate(request);
        onProgress(`Selesai menilai (${((Date.now() - started) / 1000).toFixed(1)} dtk). Menyusun hasil...`);
        return raw;
      } catch (err) {
        onProgress("Asesor AI gagal, mencoba lagi...");
        throw err;
      }
    },
  };
}

function applyUnansweredDefaults(criteria, rubric, answers, questions) {
  const emptyIdx = new Set();
  (answers || []).forEach((a, idx) => { if (!String(a || "").trim()) emptyIdx.add(idx); });
  if (emptyIdx.size === 0) return criteria;
  const out = (criteria || []).map((c) => Number.isInteger(c.answerIndex) && emptyIdx.has(c.answerIndex)
    ? { ...c, score: 0, evidence: [], unanswered: true } : c);
  const rubricCriteria = (rubric && rubric.criteria) || [];
  const n = Array.isArray(questions) ? questions.length : 0;
  for (const qi of [...emptyIdx].sort((a, b) => a - b)) {
    if ((criteria || []).some((c) => c.answerIndex === qi)) continue;
    const own = rubricCriteria.find((rc) => Array.isArray(rc.sourceIndices) && rc.sourceIndices.includes(qi));
    const uniformMatch = /^q(\d+)$/i.exec(String((rubricCriteria.find((rc) => /^q(\d+)$/i.test(String(rc.id || "")) && parseInt(/^q(\d+)$/i.exec(String(rc.id || ""))[1], 10) === qi + 1) || {}).id || ""));
    const rc = own || (uniformMatch ? rubricCriteria.find((c) => String(c.id).toLowerCase() === `q${qi + 1}`) : null);
    const criterionId = rc ? rc.id : `q${qi + 1}`;
    if (out.some((c) => c.answerIndex === qi && c.criterionId === criterionId)) continue;
    out.push({ criterionId, answerIndex: qi, score: 0, evidence: [], rationale: "Soal tidak dijawab siswa — diberi nilai default 0.", confidence: 1, unanswered: true });
  }
  return out;
}

function shouldDowngradeToReview(verification) {
  if (!verification || verification.status !== "FAIL") return false;
  const issues = Array.isArray(verification.issues) ? verification.issues : [];
  const allowed = new Set(["NO_EVIDENCE", "MISSING_CRITERION"]);
  if (issues.some((i) => i && i.type && !allowed.has(i.type))) return false;
  return issues.some((i) => i && (i.type === "NO_EVIDENCE" || i.type === "MISSING_CRITERION"));
}

function buildQuestionScores(questions, answers, criteria, rubric) {
  const byAnswer = new Map();
  for (const c of criteria || []) {
    const key = Number.isInteger(c.answerIndex) ? c.answerIndex : "all";
    if (!byAnswer.has(key)) byAnswer.set(key, []);
    byAnswer.get(key).push(c);
  }
  const allCriteria = byAnswer.get("all") || [];
  return Array.from({ length: answers.length }, (_, idx) => {
    const explicit = byAnswer.get(idx) || [];
    const declaredKeys = questionCriterionKeys(questions[idx], rubric);
    const sourceKeys = rubricSourceKeysForQuestion(rubric, idx);
    let applicable;
    if (sourceKeys.length > 0) {
      const sourceMatched = allCriteria.filter((c) => criterionMatches(c, sourceKeys));
      applicable = [...explicit, ...sourceMatched];
      if (sourceMatched.length === 0 && declaredKeys && declaredKeys.length > 0) {
        const matched = allCriteria.filter((c) => criterionMatches(c, declaredKeys));
        applicable = [...explicit, ...(matched.length > 0 ? matched : allCriteria)];
      } else if (sourceMatched.length === 0) applicable = [...explicit, ...allCriteria];
    } else if (declaredKeys && declaredKeys.length > 0) {
      const matched = allCriteria.filter((c) => criterionMatches(c, declaredKeys));
      applicable = [...explicit, ...(matched.length > 0 ? matched : allCriteria)];
    } else applicable = [...explicit, ...allCriteria];
    applicable = applicable.map((c) => withRubricWeight(c, rubric));
    const strengths = [], gaps = [], matched = [];
    for (const c of applicable) {
      if (Array.isArray(c.strengths) && c.strengths.length) strengths.push(...c.strengths.map(String).filter(Boolean));
      if (Array.isArray(c.gaps) && c.gaps.length) gaps.push(...c.gaps.map(String).filter(Boolean));
      if ((!Array.isArray(c.strengths) || !c.strengths.length) && (!Array.isArray(c.gaps) || !c.gaps.length)) {
        const { strengths: s, gaps: g } = splitFeedback(c.rationale, c.score); strengths.push(...s); gaps.push(...g);
      }
      matched.push(...(c.evidence || []).map((ev) => ev.text));
    }
    return {
      question: (questions[idx] && questions[idx].prompt) || `Soal ${idx + 1}`,
      answer: answers[idx] || "",
      score: String(answers[idx] || "").trim() ? aggregateScore(applicable) : 0,
      matched, strengths: [...new Set(strengths)], gaps: [...new Set(gaps)],
      criterionIds: applicable.map((c) => c.criterionId), confidence: averageConfidence(applicable),
      unanswered: !String(answers[idx] || "").trim(),
    };
  });
}

function questionCriterionKeys(question) {
  const raw = (question && question.criteria) || [];
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw.map((v) => typeof v === "string" ? normKey(v) : normKey(v && (v.id || v.name || v.criterionId || ""))).filter(Boolean);
}
function normKey(value) { return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim(); }
function rubricSourceKeysForQuestion(rubric, questionIndex) {
  return ((rubric && rubric.criteria) || []).filter((rc) => Array.isArray(rc.sourceIndices) && rc.sourceIndices.includes(questionIndex)).map((rc) => normKey(rc.id || rc.name || ""));
}
function criterionMatches(criterion, keys) {
  const idKey = normKey(criterion.criterionId || ""), labelKey = normKey(criterion.label || criterion.name || "");
  const stripWeight = (k) => k.replace(/\s\d+$/, "").replace(/%/g, "").trim();
  return keys.some((k) => { const ks = stripWeight(k) || k; return (idKey && (idKey === ks || idKey.includes(ks) || ks.includes(idKey))) || (labelKey && (labelKey === ks || labelKey.includes(ks) || ks.includes(labelKey))); });
}
function withRubricWeight(criterion, rubric) {
  if (Number(criterion.weight) > 0) return criterion;
  const def = ((rubric && rubric.criteria) || []).find((c) => normKey(c.id) === normKey(criterion.criterionId));
  return def ? { ...criterion, weight: Number(def.weight || 0) } : criterion;
}
function aggregateScore(criteria) {
  const scored = (criteria || []).filter((c) => Number.isFinite(Number(c.score)));
  if (scored.length === 0) return 0;
  const weightSum = scored.reduce((acc, c) => acc + Number(c.weight || 0), 0);
  if (weightSum <= 0) return clamp01(scored.reduce((acc, c) => acc + Number(c.score), 0) / scored.length);
  return clamp01(scored.reduce((acc, c) => acc + Number(c.score) * (Number(c.weight) / weightSum), 0));
}
function averageConfidence(criteria) {
  const confs = (criteria || []).map((c) => Number(c.confidence)).filter((v) => Number.isFinite(v));
  return confs.length ? confs.reduce((a, b) => a + b, 0) / confs.length : 0;
}
function calculateAlignedFinalScore(criteria, rubric, questions) {
  const mappedKeys = new Set(); let hasMapping = false;
  for (const q of questions || []) { const keys = questionCriterionKeys(q, rubric); if (!keys || !keys.length) continue; hasMapping = true; keys.forEach((k) => mappedKeys.add(k)); }
  if (!hasMapping) return null;
  const keyList = [...mappedKeys];
  const keptCriteria = (criteria || []).filter((c) => criterionMatches(c, keyList));
  const keptIds = new Set(keptCriteria.map((c) => normKey(c.criterionId)));
  const keptRubricCriteria = ((rubric && rubric.criteria) || []).filter((c) => keptIds.has(normKey(c.id)));
  if (!keptCriteria.length || !keptRubricCriteria.length) return null;
  const totalWeight = keptRubricCriteria.reduce((acc, c) => acc + Number(c.weight || 0), 0);
  const weightedRubric = { ...rubric, criteria: totalWeight > 0 ? keptRubricCriteria.map((c) => ({ ...c, weight: (Number(c.weight) || 0) / totalWeight })) : keptRubricCriteria };
  const { calculateFinalScore } = require("../evaluation/scoring");
  const weighted = calculateFinalScore(keptCriteria, weightedRubric);
  return { finalScore: Math.round(weighted.finalScore), excludedCriterionIds: ((rubric && rubric.criteria) || []).map((c) => c.id).filter((id) => !keptIds.has(normKey(id))) };
}
function structuredRubric(payload, assessment) {
  const questions = Array.isArray(assessment.questions) ? assessment.questions : [];
  const fromPerQuestion = buildRubricFromPerQuestion(questions);
  if (fromPerQuestion && fromPerQuestion.criteria.length > 0) return normalizeWeights(fromPerQuestion);
  const structured = assessment.rubric;
  if (structured && Array.isArray(structured.criteria) && structured.criteria.length > 0) return normalizeWeights(structured);
  if (typeof structured === "string" && structured.trim()) { const criteria = parseRubricText(structured); if (criteria.length > 0) return { id: "rubric-assess", criteria }; }
  const n = Math.max(1, (Array.isArray(payload.answers) ? payload.answers.length : 1));
  return { id: "rubric-uniform", criteria: Array.from({ length: n }, (_, i) => ({ id: `q${i + 1}`, name: `Soal ${i + 1}`, weight: 1 / n, scale: 100 })) };
}
function buildRubricFromPerQuestion(questions) {
  const merged = new Map(); let any = false;
  (questions || []).forEach((q, qi) => {
    const text = (q && String(q.rubric || "").trim()) || ""; if (!text) return;
    const criteria = parseRubricText(text); if (!criteria.length) return; any = true;
    for (const c of criteria) { const key = normKey(c.id); if (!merged.has(key)) merged.set(key, { ...c, sourceIndices: [qi] }); else merged.get(key).sourceIndices.push(qi); }
  });
  if (!any) return null;
  return { id: "rubric-per-question", criteria: [...merged.values()].map((c) => ({ ...c, sourceIndices: c.sourceIndices || [] })) };
}
function normalizeWeights(rubric) {
  const sum = rubric.criteria.reduce((acc, c) => acc + Number(c.weight || 0), 0);
  return { ...rubric, criteria: sum <= 0 ? rubric.criteria : rubric.criteria.map((c) => ({ ...c, weight: (Number(c.weight) || 0) / sum })) };
}
function splitSentences(rationale) { return rationale ? String(rationale).split(/[.;\n]+/).map((s) => s.trim()).filter((s) => s.length > 0).slice(0, 3) : []; }
const GAP_KEYWORDS = ["tidak", "belum", "kurang", "tidak ada", "tidak menyebut", "tidak relevan", "kurangnya", "seharusnya", "sebaiknya", "perlu", "lemah", "hilang", "tidak lengkap", "tidak sesuai", "tidak menjelaskan", "tidak mencakup", "tidak menyertakan", "tidak menggunakan", "tidak menunjukkan", "missing", "lacks", "lacking", "should", "needs", "weak", "absent", "does not", "did not", "not relevant", "not mention", "not include", "not explain", "not cover", "not use", "not show", "incomplete"];
const STRENGTH_KEYWORDS = ["benar", "tepat", "akurat", "relevan", "sesuai", "lengkap", "jelas", "baik", "memadai", "cukup", "mampu", "berhasil", "memahami", "menguasai", "menyebut", "menjelaskan", "mencakup", "menggunakan", "menunjukkan", "mengidentifikasi", "memberikan", "mengenali", "memperlihatkan", "correct", "correctly", "accurate", "relevant", "appropriate", "complete", "clear", "adequate", "properly", "successfully", "understands", "identifies", "mentions", "explains", "covers", "uses", "shows", "gives", "provides", "recognizes", "demonstrates", "good", "well"];
function splitFeedback(rationale, score) {
  const sentences = splitSentences(rationale), strengths = [], gaps = [], lowScore = Number(score) < 70;
  for (const sentence of sentences) { const lower = sentence.toLowerCase(); const isCritique = GAP_KEYWORDS.some((kw) => lower.includes(kw)); const isStrength = STRENGTH_KEYWORDS.some((kw) => lower.includes(kw)); if (isCritique) gaps.push(sentence); else if (isStrength) strengths.push(sentence); else if (lowScore) gaps.push(sentence); else strengths.push(sentence); }
  return { strengths, gaps };
}
module.exports = { evaluateWithHarness, structuredRubric, normalizeWeights, splitFeedback, buildQuestionScores, aggregateScore, averageConfidence, calculateAlignedFinalScore, questionCriterionKeys, criterionMatches, shouldDowngradeToReview };