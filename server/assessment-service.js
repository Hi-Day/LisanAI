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
    'Format: {"questions":[{"prompt":"...","focus":"...","ideal":"..."}]}. Jumlah questions harus sesuai jumlah_soal.',
    {
      tenantId: payload.tenantId,
      userId: payload.userId,
      action: "generate-questions"
    }
  );

  if (!Array.isArray(result.questions)) throw new Error("Model tidak mengembalikan daftar soal");
  return result.questions.slice(0, count).map(normalizeQuestion(payload));
}

async function recommendAssessmentConfig(payload) {
  const result = await callOpenRouter(
    [
      {
        role: "user",
        content: JSON.stringify({
          tugas: "Buat rekomendasi kompetensi atau learning outcome dan rubrik untuk assessment lisan.",
          topik: payload.topic,
          tingkat_kesulitan: payload.difficulty || "Menengah",
          konteks:
            "Guru akan memakai rekomendasi ini untuk membuat soal evaluasi lisan siswa. Gunakan bahasa Indonesia yang ringkas, operasional, dan bisa langsung diedit guru.",
        }),
      },
    ],
    'Format: {"outcomes":"3-5 learning outcome dalam baris terpisah","rubric":"rubrik berbobot total 100% dalam baris terpisah"}',
    {
      tenantId: payload.tenantId,
      userId: payload.userId,
      action: "recommend-assessment-config"
    }
  );

  return {
    outcomes: String(result.outcomes || "").trim(),
    rubric: String(result.rubric || "").trim(),
  };
}

async function evaluateAnswers(payload) {
  const qa_pairs = payload.assessment.questions.map((q, i) => ({
    question: q.prompt,
    ideal_answer: q.ideal,
    student_answer: payload.answers[i] || "(Tidak ada jawaban)"
  }));

  const result = await callOpenRouter(
    [
      {
        role: "user",
        content: JSON.stringify({
          tugas: "Nilai jawaban lisan siswa berdasarkan rubrik guru. Berikan skor objektif dan feedback personal.",
          rubrik_penilaian: payload.assessment.rubric,
          topik: payload.assessment.topic,
          studentName: payload.studentName,
          qa_pairs: qa_pairs,
        }),
      },
    ],
    'Format: {"finalScore":0-100,"feedback":"...","questionScores":[{"question":"...","answer":"...","score":0-100,"matched":["..."],"strengths":["..."],"gaps":["..."]}]}',
    {
      tenantId: payload.tenantId,
      userId: payload.userId,
      action: "evaluate"
    }
  );

  if (!Array.isArray(result.questionScores)) throw new Error("Model tidak mengembalikan penilaian per soal");
  return {
    finalScore: clampScore(result.finalScore),
    feedback: String(result.feedback || "Feedback belum tersedia."),
    questionScores: result.questionScores.map((item, index) => {
      const normalized = normalizeQuestionScore(item);
      normalized.answer = payload.answers[index] || "";
      return normalized;
    }),
  };
}

async function improveQuestionSet(payload) {
  const result = await callOpenRouter(
    [
      {
        role: "user",
        content: JSON.stringify({
          tugas: "Perbaiki question set assessment lisan agar lebih jelas, selaras dengan learning outcome dan rubrik, serta tetap sesuai tingkat kesulitan.",
          assessment_config: payload.config,
          questions: payload.questions,
        }),
      },
    ],
    'Format: {"questions":[{"prompt":"...","focus":"...","ideal":"..."}]}. Jumlah dan urutan questions harus sama dengan input.',
    {
      tenantId: payload.config?.tenantId || payload.tenantId,
      userId: payload.config?.userId || payload.userId,
      action: "improve-questions"
    }
  );

  if (!Array.isArray(result.questions)) throw new Error("Model tidak mengembalikan daftar soal");
  return result.questions.map(normalizeQuestion(payload.config || {}));
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
  improveQuestionSet,
  recommendAssessmentConfig,
};
