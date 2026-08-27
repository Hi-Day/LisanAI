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
      outcome: `Siswa mampu menjelaskan konsep ${keyword} pada materi ${topic} dengan bahasa sendiri.`,
      rubric: `Ketepatan konsep ${keyword}: 40%, penalaran sebab-akibat: 25%, contoh relevan: 20%, kejelasan komunikasi: 15%.`,
      ideal: `Jawaban kuat menyebut konsep ${keyword}, memberi alasan, memakai contoh relevan, dan mengaitkannya dengan ${topic}.`,
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
    rubric: [
      "Ketepatan konsep: 40% - jawaban sesuai konsep inti dan tidak menunjukkan miskonsepsi utama.",
      "Kelengkapan penalaran: 25% - siswa menjelaskan hubungan sebab-akibat, proses, atau alasan secara logis.",
      "Contoh dan penerapan: 20% - siswa memberikan contoh yang relevan dengan topik dan konteks pembelajaran.",
      "Kejelasan komunikasi lisan: 15% - jawaban runtut, mudah dipahami, dan menggunakan istilah kunci dengan tepat.",
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
