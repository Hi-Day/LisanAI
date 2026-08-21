const { callOpenRouter, streamOpenRouter } = require("./openrouter");

// ---------------------------------------------------------------------------
// Request builders
// ---------------------------------------------------------------------------

function buildGenerateQuestionsMessages(payload) {
  const count = Number(payload.count || 5);
  return [
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
  ];
}

const GENERATE_QUESTIONS_SCHEMA =
  'Format: {"questions":[{"prompt":"...","focus":"...","ideal":"..."}]}. Jumlah questions harus sesuai jumlah_soal.';

function buildRecommendConfigMessages(payload) {
  return [
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
  ];
}

const RECOMMEND_CONFIG_SCHEMA =
  'Format: {"outcomes":"3-5 learning outcome dalam baris terpisah","rubric":"rubrik berbobot total 100% dalam baris terpisah"}';

function buildEvaluateMessages(payload) {
  const qa_pairs = payload.assessment.questions.map((q, i) => ({
    question: q.prompt,
    learning_outcome: q.outcome || payload.assessment.outcomes || "",
    rubrik: q.rubric || payload.assessment.rubric || "",
    student_answer: payload.answers[i] || "(Tidak ada jawaban)",
  }));

  return [
    {
      role: "user",
      content: JSON.stringify({
        tugas: "Nilai jawaban lisan siswa berdasarkan rubrik guru. Berikan skor objektif dan feedback personal.",
        rubrik_penilaian: payload.assessment.rubric,
        topik: payload.assessment.topic,
        studentName: payload.studentName,
        qa_pairs,
      }),
    },
  ];
}

const EVALUATE_SCHEMA =
  'Format: {"finalScore":0-100,"feedback":"...","questionScores":[{"question":"...","answer":"...","score":0-100,"matched":["..."],"strengths":["..."],"gaps":["..."]}]}';

function buildImproveQuestionsMessages(payload) {
  return [
    {
      role: "user",
      content: JSON.stringify({
        tugas: "Perbaiki question set assessment lisan agar lebih jelas, selaras dengan learning outcome dan rubrik, serta tetap sesuai tingkat kesulitan.",
        assessment_config: payload.config,
        questions: payload.questions,
      }),
    },
  ];
}

const IMPROVE_QUESTIONS_SCHEMA =
  'Format: {"questions":[{"prompt":"...","focus":"...","ideal":"..."}]}. Jumlah dan urutan questions harus sama dengan input.';

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

function normalizeQuestion(payload) {
  return (question, index) => ({
    id: `q-ai-${Date.now()}-${index}`,
    prompt: String(question.prompt || "").trim(),
    focus: String(question.focus || payload.topic || "konsep").trim(),
    outcome: String(question.outcome || payload.outcomes || "").trim(),
    rubric: String(question.rubric || payload.rubric || "").trim(),
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

// ---------------------------------------------------------------------------
// Non-streaming (legacy) API — used by /api/v1 and tests
// ---------------------------------------------------------------------------

async function generateQuestions(payload) {
  const count = Number(payload.count || 5);
  const result = await callOpenRouter(
    buildGenerateQuestionsMessages(payload),
    GENERATE_QUESTIONS_SCHEMA,
    {
      tenantId: payload.tenantId,
      userId: payload.userId,
      action: "generate-questions",
    }
  );

  if (!Array.isArray(result.questions)) throw new Error("Model tidak mengembalikan daftar soal");
  return result.questions.slice(0, count).map(normalizeQuestion(payload));
}

async function recommendAssessmentConfig(payload) {
  const result = await callOpenRouter(
    buildRecommendConfigMessages(payload),
    RECOMMEND_CONFIG_SCHEMA,
    {
      tenantId: payload.tenantId,
      userId: payload.userId,
      action: "recommend-assessment-config",
    }
  );

  return {
    outcomes: String(result.outcomes || "").trim(),
    rubric: String(result.rubric || "").trim(),
  };
}

async function evaluateAnswers(payload) {
  const result = await callOpenRouter(
    buildEvaluateMessages(payload),
    EVALUATE_SCHEMA,
    {
      tenantId: payload.tenantId,
      userId: payload.userId,
      action: "evaluate",
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
    buildImproveQuestionsMessages(payload),
    IMPROVE_QUESTIONS_SCHEMA,
    {
      tenantId: payload.config?.tenantId || payload.tenantId,
      userId: payload.config?.userId || payload.userId,
      action: "improve-questions",
    }
  );

  if (!Array.isArray(result.questions)) throw new Error("Model tidak mengembalikan daftar soal");
  return result.questions.map(normalizeQuestion(payload.config || {}));
}

// ---------------------------------------------------------------------------
// Streaming API — used by the browser UI (SSE)
// ---------------------------------------------------------------------------

async function streamCall(messages, schemaHint, context, onChunk) {
  const { content } = await streamOpenRouter(messages, schemaHint, context, onChunk);
  return { content, parsed: parseJson(content) };
}

function parseJson(content) {
  const trimmed = content.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Respons model bukan JSON valid");
  }
}

async function streamGenerateQuestions(payload, onChunk) {
  const count = Number(payload.count || 5);
  const { parsed } = await streamCall(
    buildGenerateQuestionsMessages(payload),
    GENERATE_QUESTIONS_SCHEMA,
    { tenantId: payload.tenantId, userId: payload.userId, action: "generate-questions" },
    onChunk
  );
  if (!Array.isArray(parsed.questions)) throw new Error("Model tidak mengembalikan daftar soal");
  return parsed.questions.slice(0, count).map(normalizeQuestion(payload));
}

async function streamRecommendAssessmentConfig(payload, onChunk) {
  const { parsed } = await streamCall(
    buildRecommendConfigMessages(payload),
    RECOMMEND_CONFIG_SCHEMA,
    { tenantId: payload.tenantId, userId: payload.userId, action: "recommend-assessment-config" },
    onChunk
  );
  return {
    outcomes: String(parsed.outcomes || "").trim(),
    rubric: String(parsed.rubric || "").trim(),
  };
}

async function streamEvaluateAnswers(payload, onChunk) {
  const { parsed } = await streamCall(
    buildEvaluateMessages(payload),
    EVALUATE_SCHEMA,
    { tenantId: payload.tenantId, userId: payload.userId, action: "evaluate" },
    onChunk
  );
  if (!Array.isArray(parsed.questionScores)) throw new Error("Model tidak mengembalikan penilaian per soal");
  return {
    finalScore: clampScore(parsed.finalScore),
    feedback: String(parsed.feedback || "Feedback belum tersedia."),
    questionScores: parsed.questionScores.map((item, index) => {
      const normalized = normalizeQuestionScore(item);
      normalized.answer = payload.answers[index] || "";
      return normalized;
    }),
  };
}

async function streamImproveQuestionSet(payload, onChunk) {
  const { parsed } = await streamCall(
    buildImproveQuestionsMessages(payload),
    IMPROVE_QUESTIONS_SCHEMA,
    { tenantId: payload.config?.tenantId || payload.tenantId, userId: payload.config?.userId || payload.userId, action: "improve-questions" },
    onChunk
  );
  if (!Array.isArray(parsed.questions)) throw new Error("Model tidak mengembalikan daftar soal");
  return parsed.questions.map(normalizeQuestion(payload.config || {}));
}

module.exports = {
  evaluateAnswers,
  generateQuestions,
  improveQuestionSet,
  recommendAssessmentConfig,
  streamEvaluateAnswers,
  streamGenerateQuestions,
  streamImproveQuestionSet,
  streamRecommendAssessmentConfig,
};
