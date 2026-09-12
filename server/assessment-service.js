const { call: callOpenRouter, stream: streamOpenRouter } = require("./ai/gateway");
const alignmentHarness = require("./harness/alignment");

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

const MULTI_TASK_CONNECTOR_PATTERN =
  /\b(?:serta|kemudian|lalu|terakhir|selanjutnya|berikutnya|di samping itu|selain itu|dan|juga)\b(?=[^.!?\n]*(?:jelaskan|sebutkan|berikan|evaluasi|usulkan|uraikan|bandingkan|analisis|tuliskan|simpulkan|gambarkan|deskripsikan|terangkan|buktikan|hitung|identifikasi|kategorikan|rancang|ceritakan|tunjukkan))/i;

function isMultiPartPrompt(prompt) {
  const text = String(prompt || "").trim();
  if (!text) return false;
  if ((text.match(/\d+[\.\)]/g) || []).length > 1) return true;
  if ((text.match(/\?/g) || []).length > 1) return true;
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
    if (candidate.length > 4 && !endsWithTaskVerb && !endsWithConnector) return ensureSentenceEnding(candidate);
  }
  return ensureSentenceEnding(text);
}

// ---------------------------------------------------------------------------
// Oral-scenario question guard
// ---------------------------------------------------------------------------
const ORAL_SCENARIO_RULES = [
  "Soal harus dirancang untuk skenario UJIAN LISAN: dijawab langsung, spontan, realtime lewat lisan — BUKAN untuk ditulis atau disalin dari catatan/AI.",
  "Soal harus mengukur CARA dan PROSES berpikir siswa (menjelaskan alasan, membandingkan, mengevaluasi, memprediksi, menguji langkah) yang diutarakan spontan lewat lisan.",
  "DILARANG soal tertutup yang cukup dijawab 'ya/tidak', satu angka, satu nama, atau satu kata — karena tidak mengukur pemikiran dan mudah dihafal/ditiru AI.",
  "HINDARI soal hafalan semata ('sebutkan definisi/pengertian X') bila tidak menuntut siswa menafsirkan, menerapkan, atau menjelaskan alasan.",
  "Tetap patuhi prinsip SATU substansi: cukup satu kalimat tanya dan satu tujuan; konteks boleh ditulis sebagai kalimat pembuka deterministik, lalu diakhiri SATU pertanyaan berpikir.",
].join(" ");

const CLOSED_QUESTION_PATTERN = /\b(?:apakah|benarkah|betulkah|adakah|berapakah)\b|^(?:berapa|siapa|kapan|dimana|di mana)\b/i;
const RECALL_ONLY_PATTERN = /\b(?:definisi|pengertian|arti|cirinya|macam-macam|pengertian dari)\b/i;
const REASONING_PATTERN = /\b(?:jelaskan|mengapa|kenapa|bandingkan|evaluasi|analisiss|uraikan|usulkan|buktikan|prediksi|perkirakan|bagaimana|cara|proses|alasan|akibat|pengaruh|kaitannya)\b/i;

function isClosedRecallQuestion(prompt) {
  const text = String(prompt || "").trim();
  if (!text) return false;
  const lower = text.toLowerCase();
  if (CLOSED_QUESTION_PATTERN.test(lower) && !REASONING_PATTERN.test(lower)) return true;
  if (RECALL_ONLY_PATTERN.test(lower) && !REASONING_PATTERN.test(lower)) return true;
  return false;
}

function isOpenOralQuestion(prompt) {
  return !isClosedRecallQuestion(prompt);
}

function openClosedQuestion(prompt) {
  let text = String(prompt || "").trim();
  if (!isClosedRecallQuestion(text)) return text;
  if (/^apakah\b/i.test(text)) return ensureSentenceEnding(text.replace(/^apakah\b/i, "Mengapa"));
  if (RECALL_ONLY_PATTERN.test(text.toLowerCase())) return ensureSentenceEnding(`Jelaskan dengan kata-katamu sendiri dan sertakan alasanmu: ${text}`);
  return ensureSentenceEnding(`Bagaimana dan mengapa: ${text}`);
}

function buildOralRepairMessages(payload, prompts) {
  return [{ role: "user", content: JSON.stringify({
    tugas: "Tulis ulang setiap soal tertutup/hafalan agar cocok untuk ujian lisan yang mengukur CARA dan PROSES berpikir secara spontan. Pertahankan inti topik dan substansi yang sama.",
    topik: payload.topic,
    learning_outcome: payload.outcomes,
    aturan: ORAL_SCENARIO_RULES,
    aturan_tambahan: "SINGLE_SUBSTANCE_RULES berlaku: setiap soal tetap satu substansi dan satu kalimat tanya.",
    "jumlah_dan_urutan_hasil": "harus sama persis dengan jumlah input",
    questions_tertutup: prompts,
  })}];
}

const ORAL_REPAIR_SCHEMA = 'Format: {"questions":[{"prompt":"...","focus":"...","ideal":"..."}]}. Jumlah dan urutan questions HARUS sama dengan input.';

async function enforceOralScenario(questions, payload) {
  const flagged = [];
  questions.forEach((question, index) => { if (isClosedRecallQuestion(question.prompt)) flagged.push(index); });
  if (!flagged.length) return questions;
  let repaired = null;
  try {
    repaired = await callOpenRouter(buildOralRepairMessages(payload, flagged.map((index) => String(questions[index].prompt))), ORAL_REPAIR_SCHEMA, { tenantId: payload.tenantId, userId: payload.userId, action: "repair-questions-oral" });
  } catch (err) { console.error("Gagal memperbaiki soal tertutup, memakai deterministik:", err); }
  if (Array.isArray(repaired?.questions)) {
    flagged.forEach((index, position) => {
      const repair = repaired.questions[position];
      if (!repair) return;
      const prompt = String(repair.prompt || "").trim();
      if (isClosedRecallQuestion(prompt) || isMultiPartPrompt(prompt)) return;
      questions[index] = { ...questions[index], prompt, focus: String(repair.focus || questions[index].focus || "").trim(), ideal: String(repair.ideal || questions[index].ideal || "").trim() };
    });
  }
  questions.forEach((question) => { if (isClosedRecallQuestion(question.prompt)) question.prompt = openClosedQuestion(question.prompt); });
  return questions;
}

// ---------------------------------------------------------------------------
// Question ↔ Rubrik alignment
// ---------------------------------------------------------------------------
const parseRubricCriteria = alignmentHarness.parseRubricCriteria;
const enforceRubricAlignment = alignmentHarness.enforceRubricAlignment;

function buildGenerateQuestionsMessages(payload) {
  const count = Number(payload.count || 5);
  const rubricCriteria = parseRubricCriteria(payload) || [];
  return [{ role: "user", content: JSON.stringify({
    tugas: "Buat soal assessment lisan satu per satu sesuai konfigurasi guru.",
    topik: payload.topic,
    learning_outcome: payload.outcomes,
    rubrik: payload.rubric,
    kriteria_rubrik_yang_tersedia: rubricCriteria.map((c) => ({ id: c.id, nama: c.name, bobot: c.weight })),
    aturan_penyelarasan_soal_dengan_rubrik: [
      "Tulis setiap soal agar isi yang ditanyakan persis dapat dinilai oleh SUBSET kriteria rubrik (field criteria).",
      "Isi field criteria dengan nama kriteria yang BENAR-BENAR diuji oleh soal itu. Contoh: soal bertipe 'sebutkan/identifikasi' HANYA boleh memetakan kriteria yang terukur dari penyebutan (mis. ketepatan konsep) dan DILARANG memetakan kriteria yang butuh penjelasan, sebab-akibat, analisis, atau penerapan kecuali soal benar-benar memintanya.",
      "Soal tidak boleh menanyakan hal yang tidak diukur oleh kriteria mana pun.",
      "Seluruh kriteria dalam daftar kriteria_rubrik_yang_tersedia wajib muncul di setidaknya satu soal.",
    ].join(". "),
    aturan_rubrik_per_soal: "Buat rubric khusus untuk setiap soal berdasarkan pertanyaan yang dibuat dan learning_outcome. Rubrik harus berisi 3-4 indikator yang dapat diamati, lengkap dengan bobot total 100%, dan hanya menilai isi yang benar-benar diminta oleh pertanyaan serta selaras dengan learning outcome.",
    tingkat_kesulitan: payload.difficulty,
    contoh_soal_opsional: payload.examples || "",
    aturan_penulisan_soal: SINGLE_SUBSTANCE_RULES,
    aturan_skenario_ujian_lisan: ORAL_SCENARIO_RULES,
    jumlah_soal: count,
  })}];
}

const GENERATE_QUESTIONS_SCHEMA = 'Format: {"questions":[{"prompt":"...","focus":"...","outcome":"...","rubric":"indikator 40%\\nindikator 35%\\nindikator 25%","ideal":"...","criteria":["nama_kriteria1","nama_kriteria2"]}]}. rubric WAJIB dibuat khusus untuk setiap soal dari prompt dan learning_outcome, berisi indikator terukur dengan total bobot 100%. Field criteria memakai nama kriteria rubrik yang tersedia; gabungan kriteria semua soal wajib mencakup seluruh rubrik. Jumlah questions harus sesuai jumlah_soal.';

function buildRepairMessages(payload, prompts) {
  return [{ role: "user", content: JSON.stringify({
    tugas: "Tulis ulang soal-soal berikut agar setiap soal hanya menanyakan SATU substansi. Pertahankan esensi pertanyaan pertama.",
    topik: payload.topic,
    learning_outcome: payload.outcomes,
    aturan: SINGLE_SUBSTANCE_RULES,
    "jumlah_dan_urutan_hasil": "harus sama persis dengan jumlah input",
    questions_bertingkat: prompts,
  })}];
}

const REPAIR_QUESTIONS_SCHEMA = 'Format: {"questions":[{"prompt":"...","focus":"...","ideal":"..."}]}. Jumlah dan urutan questions HARUS sama dengan input.';

async function enforceSingleSubstance(questions, payload) {
  const flagged = [];
  questions.forEach((question, index) => { if (isMultiPartPrompt(question.prompt)) flagged.push(index); });
  if (!flagged.length) return questions;
  let repaired = null;
  try {
    repaired = await callOpenRouter(buildRepairMessages(payload, flagged.map((index) => String(questions[index].prompt))), REPAIR_QUESTIONS_SCHEMA, { tenantId: payload.tenantId, userId: payload.userId, action: "repair-questions" });
  } catch (err) { console.error("Gagal memperbaiki pertanyaan bertingkat, memakai pemangkasan deterministik:", err); }
  if (Array.isArray(repaired?.questions)) {
    flagged.forEach((index, position) => {
      const repair = repaired.questions[position];
      if (!repair || isMultiPartPrompt(String(repair.prompt))) return;
      questions[index] = { ...questions[index], prompt: String(repair.prompt).trim(), focus: String(repair.focus || questions[index].focus || "").trim(), ideal: String(repair.ideal || questions[index].ideal || "").trim() };
    });
  }
  questions.forEach((question) => { if (isMultiPartPrompt(question.prompt)) question.prompt = stripToSingleSubstance(question.prompt); });
  return questions;
}

function buildRecommendConfigMessages(payload) {
  return [{ role: "user", content: JSON.stringify({
    tugas: "Buat rekomendasi capaian pembelajaran (learning outcome) untuk assessment lisan.",
    topik: payload.topic,
    tingkat_kesulitan: payload.difficulty || "Menengah",
    konteks: "Guru akan memakai rekomendasi capaian pembelajaran ini untuk membuat soal evaluasi lisan siswa. Gunakan bahasa Indonesia yang ringkas, operasional, dan bisa langsung diedit guru.",
  })}];
}

const RECOMMEND_CONFIG_SCHEMA = 'Format: {"outcomes":"3-5 learning outcome dalam baris terpisah"}';

function buildImproveQuestionsMessages(payload) {
  return [{ role: "user", content: JSON.stringify({
    tugas: "Perbaiki question set assessment lisan agar lebih jelas, selaras dengan learning outcome dan rubrik, serta tetap sesuai tingkat kesulitan.",
    aturan_perbaikan: "Setiap soal harus hanya menanyakan SATU substansi. Jika ada soal bertingkat (meminta beberapa hal sekaligus, dihubungkan 'serta', 'kemudian', 'lalu', 'terakhir', 'selanjutnya' atau daftar bernomor), tulis ulang menjadi satu pertanyaan tunggal; konteks boleh ditulis sebagai kalimat awal yang deterministik, lalu akhiri dengan satu pertanyaan.",
    assessment_config: payload.config,
    questions: payload.questions,
  })}];
}

const IMPROVE_QUESTIONS_SCHEMA = 'Format: {"questions":[{"prompt":"...","focus":"...","ideal":"..."}]}. Jumlah dan urutan questions harus sama dengan input.';

async function calibrateRubricSet(payload) {
  const config = payload.config || payload;
  const normalized = { ...config, questions: Array.isArray(payload.questions) ? payload.questions : [] };
  const aligned = await alignmentHarness.calibrateSoalRubrik(normalized);
  return Array.isArray(aligned) ? aligned : [];
}

async function streamCalibrateRubricSet(payload, onChunk) {
  const config = payload.config || payload;
  const normalized = { ...config, questions: Array.isArray(payload.questions) ? payload.questions : [] };
  const aligned = await alignmentHarness.streamCalibrateSoalRubrik(normalized, onChunk);
  return Array.isArray(aligned) ? aligned : [];
}

function buildQuestionRubricFallback(question, payload) {
  const prompt = String(question.prompt || "").trim();
  const outcome = String(question.outcome || payload.outcomes || "").trim();
  const focus = String(question.focus || payload.topic || "konsep").trim();
  return [
    `Ketepatan menjawab pertanyaan tentang ${focus}: 40%`,
    `Keselarasan dengan learning outcome (${outcome || "kompetensi pembelajaran"}): 30%`,
    `Kelengkapan isi yang diminta dalam pertanyaan (${prompt || "pertanyaan"}): 20%`,
    "Kejelasan penyampaian jawaban: 10%",
  ].join("\n");
}

function normalizeQuestion(payload) {
  return (question, index) => ({
    id: `q-ai-${Date.now()}-${index}`,
    prompt: String(question.prompt || "").trim(),
    focus: String(question.focus || payload.topic || "konsep").trim(),
    outcome: String(question.outcome || payload.outcomes || "").trim(),
    rubric: String(question.rubric || payload.rubric || "").trim() || buildQuestionRubricFallback(question, payload),
    ideal: String(question.ideal || "Jawaban kuat sesuai rubrik guru.").trim(),
    criteria: Array.isArray(question.criteria) ? question.criteria.map(String) : [],
  });
}

async function generateQuestions(payload) {
  const count = Number(payload.count || 5);
  const result = await callOpenRouter(buildGenerateQuestionsMessages(payload), GENERATE_QUESTIONS_SCHEMA, { tenantId: payload.tenantId, userId: payload.userId, action: "generate-questions" });
  if (!Array.isArray(result.questions)) throw new Error("Model tidak mengembalikan daftar soal");
  const questions = result.questions.slice(0, count).map(normalizeQuestion(payload));
  const singleSubstance = await enforceSingleSubstance(questions, payload);
  const oralReady = await enforceOralScenario(singleSubstance, payload);
  return enforceRubricAlignment(oralReady, payload);
}

async function recommendAssessmentConfig(payload) {
  const result = await callOpenRouter(buildRecommendConfigMessages(payload), RECOMMEND_CONFIG_SCHEMA, { tenantId: payload.tenantId, userId: payload.userId, action: "recommend-assessment-config" });
  return { outcomes: String(result.outcomes || "").trim() };
}

async function improveQuestionSet(payload) {
  const result = await callOpenRouter(buildImproveQuestionsMessages(payload), IMPROVE_QUESTIONS_SCHEMA, { tenantId: payload.config?.tenantId || payload.tenantId, userId: payload.config?.userId || payload.userId, action: "improve-questions" });
  if (!Array.isArray(result.questions)) throw new Error("Model tidak mengembalikan daftar soal");
  const questions = result.questions.map(normalizeQuestion(payload.config || {}));
  const singleSubstance = await enforceSingleSubstance(questions, payload.config || payload);
  const oralReady = await enforceOralScenario(singleSubstance, payload.config || payload);
  return enforceRubricAlignment(oralReady, payload.config || payload);
}

async function streamCall(messages, schemaHint, context, onChunk) {
  const { content } = await streamOpenRouter(messages, schemaHint, context, onChunk);
  return { content, parsed: parseJson(content) };
}

function parseJson(content) {
  const trimmed = content.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(trimmed); } catch { const match = trimmed.match(/\{[\s\S]*\}/); if (match) return JSON.parse(match[0]); throw new Error("Respons model bukan JSON valid"); }
}

async function streamGenerateQuestions(payload, onChunk) {
  const count = Number(payload.count || 5);
  const { parsed } = await streamCall(buildGenerateQuestionsMessages(payload), GENERATE_QUESTIONS_SCHEMA, { tenantId: payload.tenantId, userId: payload.userId, action: "generate-questions" }, onChunk);
  if (!Array.isArray(parsed.questions)) throw new Error("Model tidak mengembalikan daftar soal");
  const questions = parsed.questions.slice(0, count).map(normalizeQuestion(payload));
  const singleSubstance = await enforceSingleSubstance(questions, payload);
  const oralReady = await enforceOralScenario(singleSubstance, payload);
  return enforceRubricAlignment(oralReady, payload);
}

async function streamRecommendAssessmentConfig(payload, onChunk) {
  const { parsed } = await streamCall(buildRecommendConfigMessages(payload), RECOMMEND_CONFIG_SCHEMA, { tenantId: payload.tenantId, userId: payload.userId, action: "recommend-assessment-config" }, onChunk);
  return { outcomes: String(parsed.outcomes || "").trim() };
}

async function streamImproveQuestionSet(payload, onChunk) {
  const { parsed } = await streamCall(buildImproveQuestionsMessages(payload), IMPROVE_QUESTIONS_SCHEMA, { tenantId: payload.config?.tenantId || payload.tenantId, userId: payload.config?.userId || payload.userId, action: "improve-questions" }, onChunk);
  if (!Array.isArray(parsed.questions)) throw new Error("Model tidak mengembalikan daftar soal");
  const questions = parsed.questions.map(normalizeQuestion(payload.config || {}));
  const singleSubstance = await enforceSingleSubstance(questions, payload.config || payload);
  const oralReady = await enforceOralScenario(singleSubstance, payload.config || payload);
  return enforceRubricAlignment(oralReady, payload.config || payload);
}

function buildProbingMessages(payload) {
  return [{ role: "user", content: JSON.stringify({
    tugas: "Buat SATU pertanyaan lanjutan (probing) untuk ujian lisan, yang menggali lebih dalam pemahaman siswa berdasarkan jawaban yang barusaja dia berikan.",
    soal: payload.prompt,
    fokus: payload.focus,
    learning_outcome: payload.outcomes,
    jawaban_siswa: payload.answer,
    aturan: [
      "Hanya SATU pertanyaan terbuka yang mendorong siswa menjelaskan, menganalisis, membandingkan, atau memberi alasan lebih dalam tentang isi jawabannya.",
      "Probing harus berbasis langsung pada isi jawaban siswa (bukan pertanyaan generik).",
      "Tidak boleh mengulang pertanyaan utama atau menanyakan hal di luar topik soal.",
      "Tetap satu substansi dan satu kalimat tanya (prinsip single-substance).",
      "Jawab dalam bahasa yang sama dengan soal/jawaban siswa.",
    ].join(". "),
  })}];
}

const PROBING_SCHEMA = 'Format: {"prompt":"satu pertanyaan lanjutan","focus":"...","ideal":"..."}';

function normalizeProbing(result, payload) {
  const focus = String(result.focus || payload.focus || payload.outcomes || "pemahaman").trim();
  return { prompt: String(result.prompt || "").trim(), focus, ideal: String(result.ideal || "").trim(), outcomes: String(payload.outcomes || "").trim() };
}

async function generateProbing(payload) {
  const result = await callOpenRouter(buildProbingMessages(payload), PROBING_SCHEMA, { tenantId: payload.tenantId, userId: payload.userId, action: "generate-probing" });
  return normalizeProbing(result, payload);
}

async function streamProbing(payload, onChunk) {
  const { parsed } = await streamCall(buildProbingMessages(payload), PROBING_SCHEMA, { tenantId: payload.tenantId, userId: payload.userId, action: "generate-probing" }, onChunk);
  return normalizeProbing(parsed, payload);
}

module.exports = {
  alignRubricSet: calibrateRubricSet,
  calibrateRubricSet,
  enforceOralScenario,
  enforceRubricAlignment,
  enforceSingleSubstance,
  generateProbing,
  generateQuestions,
  improveQuestionSet,
  isClosedRecallQuestion,
  isMultiPartPrompt,
  isOpenOralQuestion,
  mergeCalibration: alignmentHarness.mergeCalibration,
  openClosedQuestion,
  parseRubricCriteria,
  recommendAssessmentConfig,
  streamAlignRubricSet: streamCalibrateRubricSet,
  streamCalibrateRubricSet,
  streamGenerateQuestions,
  streamImproveQuestionSet,
  streamProbing,
  streamRecommendAssessmentConfig,
  stripToSingleSubstance,
};
