import { FALLBACK_KEYWORDS, FALLBACK_QUESTION_STEMS } from "./config.js";
import { getKeywords, uid } from "./utils.js";

export function generateFallbackQuestions({ topic, outcomes, rubric, difficulty, examples, count }) {
  const keywords = getKeywords(topic, outcomes, rubric, examples);
  const core = keywords.length ? keywords : FALLBACK_KEYWORDS;
  const stems = FALLBACK_QUESTION_STEMS[difficulty] || FALLBACK_QUESTION_STEMS.Menengah;

  return Array.from({ length: count }, (_, index) => {
    const keyword = core[index % core.length];
    const prompt = stems[index % stems.length]
      .replaceAll("{topic}", topic)
      .replaceAll("{keyword}", keyword);

    return {
      id: uid("q"),
      prompt,
      focus: keyword,
      ideal: `Jawaban kuat menyebut konsep ${keyword}, memberi alasan, memakai contoh relevan, dan mengaitkannya dengan ${topic}.`,
    };
  });
}

export function evaluateFallbackAssessment(assessment, answers, studentName, makeSubmission) {
  const rubricKeywords = getKeywords(assessment.rubric, assessment.outcomes, assessment.topic);
  const questionScores = assessment.questions.map((question, index) => {
    const answer = (answers[index] || "").toLowerCase();
    const words = answer.split(/\s+/).filter(Boolean);
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
      answer: answers[index] || "",
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
