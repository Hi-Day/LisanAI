const { callOpenRouter } = require("./openrouter");

async function generateQuestions(payload) {
  const count = Number(payload.count || 5);
  const result = await callOpenRouter(
    [
      {
        role: "user",
        content: JSON.stringify({
          tugas: "Buat soal assessment lisan satu per satu sesuai konfigurasi guru.",
          topik: payload.topic,
          learning_outcome: payload.outcomes,
          rubrik: payload.rubric,
          tingkat_kesulitan: payload.difficulty,
          contoh_soal_opsional: payload.examples || "",
          jumlah_soal: count,
        }),
      },
    ],
    'Format: {"questions":[{"prompt":"...","focus":"...","ideal":"..."}]}. Jumlah questions harus sesuai jumlah_soal.'
  );

  if (!Array.isArray(result.questions)) throw new Error("Model tidak mengembalikan daftar soal");
  return result.questions.slice(0, count).map(normalizeQuestion(payload));
}

async function evaluateAnswers(payload) {
  const result = await callOpenRouter(
    [
      {
        role: "user",
        content: JSON.stringify({
          tugas: "Nilai jawaban lisan siswa berdasarkan rubrik guru. Berikan skor objektif dan feedback personal.",
          assessment: payload.assessment,
          studentName: payload.studentName,
          answers: payload.answers,
        }),
      },
    ],
    'Format: {"finalScore":0-100,"feedback":"...","questionScores":[{"question":"...","answer":"...","score":0-100,"matched":["..."],"strengths":["..."],"gaps":["..."]}]}'
  );

  if (!Array.isArray(result.questionScores)) throw new Error("Model tidak mengembalikan penilaian per soal");
  return {
    finalScore: clampScore(result.finalScore),
    feedback: String(result.feedback || "Feedback belum tersedia."),
    questionScores: result.questionScores.map(normalizeQuestionScore),
  };
}

function normalizeQuestion(payload) {
  return (question, index) => ({
    id: `q-ai-${Date.now()}-${index}`,
    prompt: String(question.prompt || "").trim(),
    focus: String(question.focus || payload.topic || "konsep").trim(),
    ideal: String(question.ideal || "Jawaban kuat sesuai rubrik guru.").trim(),
  });
}

function normalizeQuestionScore(item) {
  return {
    question: String(item.question || ""),
    answer: String(item.answer || ""),
    score: clampScore(item.score),
    matched: Array.isArray(item.matched) ? item.matched.map(String) : [],
    strengths: Array.isArray(item.strengths) ? item.strengths.map(String) : [],
    gaps: Array.isArray(item.gaps) ? item.gaps.map(String) : [],
  };
}

function clampScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

module.exports = {
  evaluateAnswers,
  generateQuestions,
};
