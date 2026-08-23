const { callOpenRouter, streamOpenRouter } = require("./openrouter");

// ---------------------------------------------------------------------------
// Single-substance question guard
// ---------------------------------------------------------------------------
// Aturan: tiap soal hanya menanyakan SATU substansi. Pertanyaan bertingkat
// (meminta beberapa hal dalam satu prompt) dilarang; konteks boleh ditulis
// sebagai kalimat informasi awal yang deterministik, lalu SATU pertanyaan.

const SINGLE_SUBSTANCE_RULES = [
  "Setiap soal hanya menanyakan SATU substansi (satu kompetensi/tujuan pembelajaran).",
  "DILARANG pertanyaan bertingkat yang meminta beberapa hal sekaligus dalam satu soal, misalnya gabungan 'jelaskan ... berikan contoh ... serta evaluasi ... Terakhir usulkan ...'.",
  "Setiap soal cukup SATU kalimat tanya dengan SATU tanda tanya; hindari kata penghubung tugas ganda seperti 'serta', 'kemudian', 'lalu', 'terakhir', 'selanjutnya', 'dan berikan contoh'.",
  "Jika konteks diperlukan, tulis konteks sebagai kalimat informasi di awal soal (deterministik), lalu akhiri dengan SATU pertanyaan/instruksi tunggal yang bisa dijawab lisan.",
].join(". ");

const TASK_VERB_PATTERN =
  /\b(?:jelaskan|sebutkan|berikan|evaluasi|usulkan|uraikan|bandingkan|analisis|tuliskan|simpulkan|gambarkan|deskripsikan|terangkan|buktikan|hitung|identifikasi|kategorikan|rancang|ceritakan|tunjukkan)\w*/i;

// Kata hubung yang memperkenalkan TUGAS tambahan di dalam satu kalimat soal.
const MULTI_TASK_CONNECTOR_PATTERN =
  /\b(?:serta|kemudian|lalu|terakhir|selanjutnya|berikutnya|di samping itu|selain itu|dan|juga)\b(?=[^.!?\n]*(?:jelaskan|sebutkan|berikan|evaluasi|usulkan|uraikan|bandingkan|analisis|tuliskan|simpulkan|gambarkan|deskripsikan|terangkan|buktikan|hitung|identifikasi|kategorikan|rancang|ceritakan|tunjukkan))/i;

/**
 * Deteksi apakah sebuah prompt menanyakan lebih dari satu substansi.
 * Konteks + satu tugas tetap dianggap valid (satu substansi).
 */
function isMultiPartPrompt(prompt) {
  const text = String(prompt || "").trim();
  if (!text) return false;

  if ((text.match(/\d+[\.\)]/g) || []).length > 1) return true; // daftar bernomor
  if ((text.match(/\?/g) || []).length > 1) return true; // lebih dari satu tanda tanya

  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let taskCount = 0;
  for (const sentence of sentences) {
    const verbs = sentence.match(TASK_VERB_PATTERN) || [];
    if (verbs.length > 1) return true;
    if (verbs.length === 1 || sentence.includes("?")) taskCount += 1;
    if (taskCount > 1) return true;
    if (MULTI_TASK_CONNECTOR_PATTERN.test(sentence)) return true;
  }
  return false;
}

function ensureSentenceEnding(text) {
  const trimmed = String(text || "").trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/**
 * Pemangkasan deterministik (last resort bila perbaikan model gagal):
 * pertahankan kalimat tugas pertama (beserta konteks pendahulunya), atau
 * potong pada kata hubung yang memperkenalkan tugas kedua.
 */
function stripToSingleSubstance(prompt) {
  let text = String(prompt || "").trim();
  if (!isMultiPartPrompt(text)) return text;

  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  if (sentences.length > 1) {
    const firstTaskIdx = sentences.findIndex((s) => s.includes("?") || TASK_VERB_PATTERN.test(s));
    if (firstTaskIdx >= 0) {
      const candidate = sentences.slice(0, firstTaskIdx + 1).join(" ").trim();
      if (!isMultiPartPrompt(candidate)) return ensureSentenceEnding(candidate);
      text = candidate;
    }
  }

  const cut = text.match(MULTI_TASK_CONNECTOR_PATTERN);
  if (cut) {
    const candidate = text.slice(0, cut.index).trim();
    const lastToken = candidate.split(/\s+/).pop() || "";
    const endsWithTaskVerb = TASK_VERB_PATTERN.test(lastToken);
    const endsWithConnector = /^(?:serta|kemudian|lalu|terakhir|selanjutnya|berikutnya|dan|juga|di)$/i.test(lastToken);
    if (candidate.length > 4 && !endsWithTaskVerb && !endsWithConnector) {
      return ensureSentenceEnding(candidate);
    }
  }

  return ensureSentenceEnding(text);
}

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
        aturan_penulisan_soal: SINGLE_SUBSTANCE_RULES,
        jumlah_soal: count,
      }),
    },
  ];
}

const GENERATE_QUESTIONS_SCHEMA =
  'Format: {"questions":[{"prompt":"...","focus":"...","ideal":"..."}]}. Jumlah questions harus sesuai jumlah_soal.';

function buildRepairMessages(payload, prompts) {
  return [
    {
      role: "user",
      content: JSON.stringify({
        tugas: "Tulis ulang soal-soal berikut agar setiap soal hanya menanyakan SATU substansi. Pertahankan esensi pertanyaan pertama.",
        topik: payload.topic,
        learning_outcome: payload.outcomes,
        aturan: SINGLE_SUBSTANCE_RULES,
        "jumlah_dan_urutan_hasil": "harus sama persis dengan jumlah input",
        questions_bertingkat: prompts,
      }),
    },
  ];
}

const REPAIR_QUESTIONS_SCHEMA =
  'Format: {"questions":[{"prompt":"...","focus":"...","ideal":"..."}]}. Jumlah dan urutan questions HARUS sama dengan input.';

// ---------------------------------------------------------------------------
// Enforcement: perbaikan model + pemangkasan deterministik saat fallback
// ---------------------------------------------------------------------------

async function enforceSingleSubstance(questions, payload) {
  const flagged = [];
  questions.forEach((question, index) => {
    if (isMultiPartPrompt(question.prompt)) flagged.push(index);
  });
  if (!flagged.length) return questions;

  let repaired = null;
  try {
    repaired = await callOpenRouter(
      buildRepairMessages(payload, flagged.map((index) => String(questions[index].prompt))),
      REPAIR_QUESTIONS_SCHEMA,
      { tenantId: payload.tenantId, userId: payload.userId, action: "repair-questions" }
    );
  } catch (err) {
    console.error("Gagal memperbaiki pertanyaan bertingkat, memakai pemangkasan deterministik:", err);
  }

  if (Array.isArray(repaired?.questions)) {
    flagged.forEach((index, position) => {
      const repair = repaired.questions[position];
      if (!repair) return;
      if (isMultiPartPrompt(String(repair.prompt))) return;
      questions[index] = {
        ...questions[index],
        prompt: String(repair.prompt).trim(),
        focus: String(repair.focus || questions[index].focus || "").trim(),
        ideal: String(repair.ideal || questions[index].ideal || "").trim(),
      };
    });
  }

  questions.forEach((question) => {
    if (isMultiPartPrompt(question.prompt)) {
      question.prompt = stripToSingleSubstance(question.prompt);
    }
  });
  return questions;
}

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
  const isOralExam = payload.assessment?.oralExamEnabled !== false;
  const qa_pairs = payload.assessment.questions.map((q, i) => ({
    question: q.prompt,
    learning_outcome: q.outcome || payload.assessment.outcomes || "",
    rubrik: q.rubric || payload.assessment.rubric || "",
    student_answer: payload.answers[i] || "(Tidak ada jawaban)",
  }));

  const pedomanPenilaianLisan = isOralExam
    ? "INSTRUKSI PENTING: Ini adalah UJIAN LISAN, jawaban siswa adalah transkrip ucapan lisan (hasil speech-to-text). " +
      "Oleh karena itu JANGAN memberi hukuman/penilaian terhadap: tanda baca, tata tulis, struktur kalimat tertulis, ragam bahasa formal, atau kalimat yang terkesan bertele/kurang rapi. " +
      "Nilai berdasarkan: keakuratan dan kelengkapan isi, kesesuaian dengan rubrik, pemahaman konsep, serta kemampuan mengkomunikasikan ide secara lisan. " +
      "Feedback strength dapat menyarikan; feedback tentang 'kurang' hanya boleh menyebutkan aspek SUBSTANSI (isi, pemahaman, kelengkapan, kejelasan ide) — bukan yang mengenai format tulisan."
    : "Nilai jawaban siswa berdasarkan rubrik guru. Berikan skor objektif dan feedback personal.";

  return [
    {
      role: "user",
      content: JSON.stringify({
        tugas: "Nilai ujian lisan siswa berdasarkan rubrik guru. Berikan skor objektif dan feedback personal yang ramah.",
        jenis_penilaian: isOralExam ? "ujian lisan / oral examination" : "jawaban tertulis",
        pedoman_penilaian: pedomanPenilaianLisan,
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
        aturan_perbaikan:
          "Setiap soal harus hanya menanyakan SATU substansi. Jika ada soal bertingkat (meminta beberapa hal sekaligus, dihubungkan 'serta', 'kemudian', 'lalu', 'terakhir', 'selanjutnya' atau daftar bernomor), tulis ulang menjadi satu pertanyaan tunggal; konteks boleh ditulis sebagai kalimat awal yang deterministik, lalu akhiri dengan satu pertanyaan.",
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
  const questions = result.questions.slice(0, count).map(normalizeQuestion(payload));
  return enforceSingleSubstance(questions, payload);
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
  const questions = result.questions.map(normalizeQuestion(payload.config || {}));
  return enforceSingleSubstance(questions, payload.config || payload);
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
  const questions = parsed.questions.slice(0, count).map(normalizeQuestion(payload));
  return enforceSingleSubstance(questions, payload);
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
  const questions = parsed.questions.map(normalizeQuestion(payload.config || {}));
  return enforceSingleSubstance(questions, payload.config || payload);
}

module.exports = {
  enforceSingleSubstance,
  evaluateAnswers,
  generateQuestions,
  improveQuestionSet,
  isMultiPartPrompt,
  recommendAssessmentConfig,
  streamEvaluateAnswers,
  streamGenerateQuestions,
  streamImproveQuestionSet,
  streamRecommendAssessmentConfig,
  stripToSingleSubstance,
};
