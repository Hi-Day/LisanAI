import { FALLBACK_KEYWORDS, FALLBACK_QUESTION_STEMS } from "./config.js";
import { getKeywords, uid } from "./utils.js";

const DEMANDS = [
  { type: "reasoning", pattern: /\b(?:mengapa|kenapa|alasan|jelaskan\s+(?:mengapa|alasan|hubungan|proses)|argumen|argumentasi|sebab|akibat|konsekuensi)\b/i, label: "penalaran sebab-akibat" },
  { type: "application", pattern: /\b(?:contoh|misal|misalnya|penerapan|diterapkan|kasus|situasi|gunakan)\b/i, label: "penerapan/contoh" },
  { type: "comparison", pattern: /\b(?:bandingkan|perbandingan|persamaan|perbedaan)\b/i, label: "perbandingan" },
  { type: "analysis", pattern: /\b(?:analisis|analisa|hubungan|dampak|pengaruh|keterkaitan)\b/i, label: "analisis" },
  { type: "evaluation", pattern: /\b(?:evaluasi|nilai|menilai|kritik|kelemahan|kelebihan|keterbatasan)\b/i, label: "evaluasi" },
  { type: "identification", pattern: /\b(?:sebutkan|identifikasi|tentukan|nama(?:kan)?)\b/i, label: "identifikasi" },
];

function inferFallbackCriteria(prompt, keyword) {
  const text = String(prompt || "");
  const criteria = [];
  const base = /\b(?:jelaskan|pengertian|konsep|pemahaman|uraikan|terangkan)\b/i.test(text)
    ? `Ketepatan menjelaskan konsep ${keyword}`
    : `Ketepatan memahami ${keyword}`;
  criteria.push(base);

  for (const demand of DEMANDS) {
    if (!demand.pattern.test(text)) continue;
    const name = demand.type === "reasoning"
      ? `Kualitas ${demand.label}`
      : `Kesesuaian ${demand.label}`;
    if (!criteria.includes(name)) criteria.push(name);
  }
  return criteria.slice(0, 3);
}

function buildFallbackRubric(criteria) {
  if (!criteria.length) return "";
  const rawWeights = criteria.length === 1 ? [100] : criteria.map(() => 100 / criteria.length);
  return criteria
    .map((name, index) => `${name}: ${Number(rawWeights[index].toFixed(2))}%`)
    .join("\n");
}

function normalizeLearningOutcomes(value) {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (typeof item === "string") return { id: `LO${index + 1}`, text: item.trim() };
      return {
        id: String(item?.id || item?.learningOutcomeId || `LO${index + 1}`).trim(),
        text: String(item?.text || item?.name || item?.title || item?.outcome || "").trim(),
      };
    }).filter((item) => item.text);
  }
  return String(value || "").split(/\r?\n|\s*;\s*/).map((text, index) => ({
    id: `LO${index + 1}`,
    text: text.trim().replace(/^(?:\d+|LO\d+)[.)\-:]?\s*/i, ""),
  })).filter((item) => item.text);
}

function outcomeTokens(text) {
  return new Set(String(text || "").toLowerCase().replace(/[^a-z0-9\u00C0-\u024F]+/gi, " ").split(/\s+/).filter((token) => token.length >= 4));
}

function outcomeFitScore(question, outcome) {
  const qTokens = outcomeTokens([question.prompt, question.focus].filter(Boolean).join(" "));
  let score = 0;
  outcomeTokens(outcome.text).forEach((token) => { if (qTokens.has(token)) score += 1; });
  return score;
}

/**
 * Preserve the teacher's LO list as the single source of competency targets.
 * Every generated fallback question gets exactly one LO, and when there are
 * enough questions every target is represented at least once.
 */
export function ensureFallbackLearningOutcomeCoverage(questions = [], outcomesValue = "") {
  const outcomes = normalizeLearningOutcomes(outcomesValue);
  if (!outcomes.length || !questions.length) return questions;
  const result = questions.map((question) => ({ ...question }));
  const assigned = new Map();

  // First respect any valid explicit mapping.
  result.forEach((question, index) => {
    const id = String(question.learningOutcomeId || question.outcomeId || "").trim().toLowerCase();
    const match = outcomes.find((outcome) => outcome.id.toLowerCase() === id);
    if (match) assigned.set(index, match);
  });

  const counts = () => {
    const map = new Map(outcomes.map((outcome) => [outcome.id, 0]));
    assigned.forEach((outcome) => map.set(outcome.id, (map.get(outcome.id) || 0) + 1));
    return map;
  };

  for (const outcome of outcomes) {
    if ((counts().get(outcome.id) || 0) > 0) continue;
    const currentCounts = counts();
    const candidates = result.map((question, index) => {
      const current = assigned.get(index);
      if (current && (currentCounts.get(current.id) || 0) <= 1) return null;
      return { index, score: outcomeFitScore(question, outcome), current };
    }).filter(Boolean).sort((a, b) => b.score - a.score || Number(Boolean(a.current)) - Number(Boolean(b.current)) || a.index - b.index);
    if (candidates[0]) assigned.set(candidates[0].index, outcome);
  }

  // If the number of questions is smaller than the number of LOs, coverage is
  // impossible; otherwise fill remaining questions with their best LO.
  result.forEach((question, index) => {
    if (!assigned.has(index)) {
      const best = outcomes.slice().sort((a, b) => outcomeFitScore(question, b) - outcomeFitScore(question, a) || a.id.localeCompare(b.id))[0];
      if (best) assigned.set(index, best);
    }
  });

  return result.map((question, index) => {
    const outcome = assigned.get(index);
    return outcome
      ? { ...question, learningOutcomeId: outcome.id, outcome: outcome.text }
      : question;
  });
}

/**
 * Local fallback generator with the same core pedagogical invariant as the
 * server-side grounding harness: a criterion may only be attached when the
 * question explicitly provides an evidence demand for it. It deliberately
 * does NOT use a generic 40/25/20/15 rubric, because that would score evidence
 * the fallback question never asked for.
 */
export function generateFallbackQuestions({ topic, outcomes, rubric, difficulty, examples, count }) {
  const keywords = getKeywords(topic, outcomes, rubric, examples);
  const core = keywords.length ? keywords : FALLBACK_KEYWORDS;
  const stems = FALLBACK_QUESTION_STEMS[difficulty] || FALLBACK_QUESTION_STEMS.Menengah;

  const questions = Array.from({ length: count }, (_, index) => {
    const keyword = core[index % core.length];
    const prompt = stems[index % stems.length]
      .replaceAll("{topic}", topic)
      .replaceAll("{keyword}", keyword);
    const criteria = inferFallbackCriteria(prompt, keyword);
    const questionRubric = buildFallbackRubric(criteria);

    return {
      id: uid("q"),
      prompt,
      focus: keyword,
      outcome: "",
      learningOutcomeId: "",
      criteria,
      rubric: questionRubric,
      ideal: `Jawaban kuat menunjukkan pemahaman ${keyword}${criteria.length > 1 ? ", disertai evidence sesuai tuntutan pertanyaan" : ""} dan mengaitkannya dengan ${topic}.`,
    };
  });

  return ensureFallbackLearningOutcomeCoverage(questions, outcomes);
}

/** Re-ground existing local fallback questions without changing their prompts. */
export function groundFallbackQuestions(questions = []) {
  return questions.map((question) => {
    const criteria = inferFallbackCriteria(question.prompt, question.focus || "konsep");
    return {
      ...question,
      criteria,
      rubric: buildFallbackRubric(criteria),
    };
  });
}

export function generateProbingFallback({ prompt, answer, focus = "", topic = "" }) {
  const text = String(answer || "").trim();
  const focusName = String(focus || topic || "topik").trim();
  if (!text) {
    return {
      prompt: `Karena jawaban kosong, jelaskan minimal satu ide utama yang kamu pahami tentang ${focusName}, lalu beri satu alasan mengapa itu penting.`,
      focus: focusName,
    };
  }
  const mentionsReason = /\b(karena|sebab|akibat|mengapa|alasan|jadi)\b/i.test(text);
  const hasExample = /\b(contoh|misal|seperti|misalnya|ilustrasi)\b/i.test(text);
  if (!hasExample) {
    return {
      prompt: `Kamu menyebutkan "${truncateAnswer(text)}". Berikan satu contoh nyata yang menggambarkan hal itu, lalu jelaskan kaitannya dengan ${focusName}.`,
      focus: focusName,
    };
  }
  if (!mentionsReason) {
    return {
      prompt: `Kamu menyebutkan "${truncateAnswer(text)}". Jelaskan alasan atau sebab-akibat di balik itu menurut pemahamanmu.`,
      focus: focusName,
    };
  }
  return {
    prompt: `Dari jawabanmu ("${truncateAnswer(text)}"), bandingkan dengan situasi atau sudut pandang lain, lalu simpulkan mana yang lebih tepat menurutmu dan mengapa.`,
    focus: focusName,
  };
}

function truncateAnswer(text) {
  const t = String(text || "").trim();
  return t.length > 90 ? `${t.slice(0, 90)}…` : t;
}

export function recommendFallbackConfig(topic, difficulty = "Menengah") {
  return {
    outcomes: [
      `Siswa mampu menjelaskan konsep utama pada materi ${topic} dengan bahasa sendiri.`,
      `Siswa mampu menghubungkan konsep ${topic} dengan contoh atau situasi nyata yang relevan.`,
      `Siswa mampu menyampaikan alasan, bukti, atau proses berpikir secara runtut dalam jawaban lisan tingkat ${difficulty.toLowerCase()}.`,
    ].join("\n"),
  };
}

export function evaluateFallbackAssessment(assessment, answers, studentName, makeSubmission) {
  const questionScores = assessment.questions.map((question, index) => {
    const answerObj = answers[index];
    const rawAnswer = typeof answerObj === 'string' ? answerObj : (answerObj?.text || "");
    const answer = rawAnswer.toLowerCase();
    const words = answer.split(/\s+/).filter(Boolean);
    const questionRubric = question.rubric || assessment.rubric;
    const questionOutcome = question.outcome || assessment.outcomes;
    const rubricKeywords = getKeywords(questionRubric, questionOutcome, assessment.topic);
    const matched = rubricKeywords.filter((keyword) => answer.includes(keyword.toLowerCase()));
    const focusMatched = answer.includes(question.focus.toLowerCase());
    const lengthScore = Math.min(words.length / 55, 1) * 32;
    const keywordScore = Math.min(matched.length / Math.max(rubricKeywords.length, 1), 1) * 38;
    const reasoningScore = /(karena|sebab|contoh|misalnya|akibat|sehingga|dibanding)/i.test(answer) ? 20 : 8;
    const focusScore = focusMatched ? 10 : 2;
    const score = Math.round(Math.min(100, lengthScore + keywordScore + reasoningScore + focusScore));

    return {
      question: question.prompt,
      focus: question.focus,
      answer: rawAnswer,
      audio: typeof answerObj === 'string' ? null : (answerObj?.audio || null),
      duration: typeof answerObj === 'string' ? 0 : (answerObj?.duration || 0),
      score,
      matched,
      strengths: buildStrengths(score, matched, focusMatched),
      gaps: buildGaps(score, matched, rubricKeywords, question.focus),
    };
  });

  const finalScore = Math.round(questionScores.reduce((sum, item) => sum + item.score, 0) / questionScores.length);
  return makeSubmission({
    assessment,
    studentName,
    finalScore,
    questionScores,
    feedback: buildPersonalFeedback(finalScore),
  });
}

function buildStrengths(score, matched, focusMatched) {
  const strengths = [];
  if (score >= 70) strengths.push("Jawaban menunjukkan pemahaman konsep yang cukup kuat.");
  if (matched.length) strengths.push(`Istilah kunci yang muncul: ${matched.slice(0, 4).join(", ")}.`);
  if (focusMatched) strengths.push("Fokus pertanyaan terjawab secara eksplisit.");
  return strengths.length ? strengths : ["Jawaban sudah memberi dasar untuk dianalisis lebih lanjut."];
}

function buildGaps(score, matched, rubricKeywords, focus) {
  const missing = rubricKeywords.filter((keyword) => !matched.includes(keyword)).slice(0, 3);
  const gaps = [];
  if (score < 70) gaps.push("Tambahkan alasan, hubungan konsep, dan contoh konkret agar jawaban lebih utuh.");
  if (missing.length) gaps.push(`Pertimbangkan memasukkan konsep: ${missing.join(", ")}.`);
  if (!matched.includes(focus)) gaps.push(`Perjelas bagian yang berkaitan langsung dengan ${focus}.`);
  return gaps;
}

function buildPersonalFeedback(score) {
  if (score >= 85) return "Pemahaman sangat baik. Langkah berikutnya adalah membuat argumen lebih kritis dan mengantisipasi miskonsepsi.";
  if (score >= 70) return "Pemahaman sudah cukup solid. Perkuat jawaban dengan contoh yang lebih spesifik dan hubungan antar konsep.";
  if (score >= 55) return "Dasar pemahaman mulai terlihat. Fokus pada istilah kunci, urutan penjelasan, dan alasan sebab-akibat.";
  return "Perlu penguatan konsep dasar. Coba ulangi materi inti, lalu jawab dengan pola definisi, alasan, dan contoh.";
}
