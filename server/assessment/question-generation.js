const { call: callOpenRouter, stream: streamOpenRouter } = require("../ai/gateway");
const { parseJson } = require("../ai/response-parser");
const alignment = require("../harness/alignment");
const learningOutcomeAlignment = require("../harness/learning-outcome-alignment");

const SINGLE_SUBSTANCE_RULES = [
  "Setiap soal mengukur satu substansi utama.",
  "Jika satu soal memiliki lebih dari satu Learning Outcome pada LO plan, gabungkan hanya LO yang memang relevan secara kontekstual menjadi satu tugas/integrated competency.",
  "DILARANG pertanyaan bertingkat yang meminta beberapa hal sekaligus jika hal-hal tersebut tidak berasal dari LO yang sudah dipetakan ke soal.",
  "Setiap soal cukup satu kalimat tanya dengan satu tanda tanya; konteks boleh ditulis sebagai kalimat informasi di awal.",
].join(" ");

const ORAL_SCENARIO_RULES = [
  "Soal harus dirancang untuk skenario UJIAN LISAN: dijawab langsung, spontan, realtime lewat lisan.",
  "Soal harus mengukur CARA dan PROSES berpikir siswa.",
  "DILARANG soal tertutup yang cukup dijawab ya/tidak, satu angka, satu nama, atau satu kata.",
  "HINDARI soal hafalan semata bila tidak menuntut siswa menafsirkan, menerapkan, atau menjelaskan alasan.",
].join(" ");

function createLearningOutcomeQuestionPlan(payload) {
  const count = Number(payload.count || 5);
  const outcomes = learningOutcomeAlignment.parseLearningOutcomes(payload.outcomes);
  if (!outcomes.length) return [];
  const plan = learningOutcomeAlignment.buildLearningOutcomeQuestionPlan(outcomes, count);
  if (plan.length !== count) throw new Error("Gagal membuat LO-to-question plan untuk seluruh soal");
  const covered = new Set(plan.flatMap((item) => item.learningOutcomeIds));
  const missing = outcomes.filter((lo) => !covered.has(lo.id));
  if (missing.length) throw new Error(`LO plan tidak mencakup semua Learning Outcome: ${missing.map((lo) => lo.id).join(", ")}`);
  return plan;
}

function buildMessages(payload) {
  const count = Number(payload.count || 5);
  const criteria = alignment.parseRubricCriteria(payload) || [];
  const outcomes = learningOutcomeAlignment.parseLearningOutcomes(payload.outcomes);
  const plan = createLearningOutcomeQuestionPlan(payload);
  return [{ role: "user", content: JSON.stringify({
    tugas: "Buat soal assessment lisan satu per satu berdasarkan LO-to-question plan yang SUDAH DITETAPKAN.",
    topik: payload.topic,
    learning_outcomes: outcomes.map((lo) => ({ id: lo.id, text: lo.text })),
    lo_to_question_plan: plan.map((item) => ({
      nomor_soal: item.questionIndex + 1,
      learning_outcome_ids: item.learningOutcomeIds,
      learning_outcomes: item.learningOutcomes,
    })),
    rubrik: payload.rubric,
    kriteria_rubrik_yang_tersedia: criteria.map((c) => ({ id: c.id, nama: c.name, bobot: c.weight })),
    aturan_penyelarasan_dengan_lo_plan: [
      "LO-to-question plan adalah keputusan mapping yang sudah divalidasi SEBELUM generasi soal; JANGAN mengubah, menghapus, atau menambah mapping.",
      "Setiap nomor soal HARUS menggunakan tepat daftar learning_outcome_ids yang diberikan pada LO-to-question plan untuk nomor tersebut.",
      "learningOutcomeIds WAJIB sama persis dengan ID pada plan.",
      "Field outcome HARUS merepresentasikan teks Learning Outcome pada plan dan tidak boleh membuat LO baru.",
      "Isi pertanyaan harus benar-benar meminta evidence yang dapat menunjukkan pencapaian semua LO yang dipetakan ke soal tersebut.",
    ].join(". "),
    aturan_penyelarasan_soal_dengan_rubrik: [
      "Tulis setiap soal agar isi yang ditanyakan persis dapat dinilai oleh SUBSET kriteria rubrik.",
      "Isi criteria hanya dengan kriteria yang BENAR-BENAR diuji oleh soal tersebut.",
      "Soal tidak boleh menanyakan hal yang tidak diukur oleh kriteria mana pun.",
      "Jangan memaksakan criterion ke soal hanya demi coverage.",
    ].join(". "),
    aturan_rubrik_per_soal: "Buat rubric khusus untuk setiap soal berdasarkan pertanyaan dan LO pada plan. Setiap criterion harus memiliki evidence demand yang eksplisit di pertanyaan. Jangan menambahkan indikator yang tidak diminta pertanyaan.",
    tingkat_kesulitan: payload.difficulty,
    contoh_soal_opsional: payload.examples || "",
    aturan_penulisan_soal: SINGLE_SUBSTANCE_RULES,
    aturan_skenario_ujian_lisan: ORAL_SCENARIO_RULES,
    jumlah_soal: count,
  }) }];
}

const SCHEMA = 'Format: {"questions":[{"prompt":"...","focus":"...","learningOutcomeIds":["LO1"],"learningOutcomeId":"LO1","outcome":"teks Learning Outcome persis dari plan","rubric":"indikator 40%\\nindikator 35%\\nindikator 25%","ideal":"...","criteria":["nama_kriteria1","nama_kriteria2"]}]}. learningOutcomeIds WAJIB sama persis dengan LO-to-question plan. learningOutcomeId adalah ID pertama untuk kompatibilitas. outcome WAJIB mengikuti LO pada plan. rubric WAJIB khusus untuk setiap soal. Jumlah questions harus sesuai jumlah_soal.';

function buildFallbackRubric(question, payload, planItem) {
  const focus = String(question.focus || payload.topic || "konsep").trim();
  const mappedText = planItem?.learningOutcomes?.map((lo) => lo.text).join("; ").trim();
  const outcome = mappedText || String(question.outcome || "").trim() || String(learningOutcomeAlignment.parseLearningOutcomes(payload.outcomes)[0]?.text || "kompetensi pembelajaran").trim();
  return [`Ketepatan menjawab pertanyaan tentang ${focus}: 40%`, `Keselarasan dengan learning outcome (${outcome}): 30%`, "Kelengkapan evidence yang diminta pertanyaan: 20%", "Kejelasan penyampaian jawaban: 10%"].join("\n");
}

function normalizeQuestion(payload, planItem) {
  return (question, index) => {
    const mapped = planItem || null;
    const mappedIds = mapped?.learningOutcomeIds || [];
    const mappedText = mapped?.learningOutcomes?.map((lo) => lo.text).join("; ") || "";
    return {
      id: `q-ai-${Date.now()}-${index}`,
      prompt: String(question.prompt || "").trim(),
      focus: String(question.focus || payload.topic || "konsep").trim(),
      learningOutcomeIds: mappedIds.length ? [...mappedIds] : (Array.isArray(question.learningOutcomeIds) ? question.learningOutcomeIds.map(String) : []),
      learningOutcomeId: mappedIds[0] || String(question.learningOutcomeId || question.outcomeId || "").trim(),
      outcome: mappedText || String(question.outcome || "").trim(),
      rubric: String(question.rubric || "").trim() || buildFallbackRubric(question, payload, mapped),
      ideal: String(question.ideal || "Jawaban kuat sesuai rubrik guru.").trim(),
      criteria: Array.isArray(question.criteria) ? question.criteria.map(String) : [],
    };
  };
}

function normalizeGeneratedQuestions(payload, questions, plan) {
  const outcomes = learningOutcomeAlignment.parseLearningOutcomes(payload.outcomes);
  if (!outcomes.length) return questions;
  const mapped = plan || createLearningOutcomeQuestionPlan(payload);
  const normalized = questions.map((question, index) => normalizeQuestion(payload, mapped[index])(question, index));
  learningOutcomeAlignment.validateLearningOutcomeCoverage(normalized, outcomes);
  return normalized;
}

async function generateQuestions(payload) {
  const count = Number(payload.count || 5);
  const plan = createLearningOutcomeQuestionPlan(payload);
  const result = await callOpenRouter(buildMessages(payload), SCHEMA, { tenantId: payload.tenantId, userId: payload.userId, action: "generate-questions" });
  if (!Array.isArray(result.questions)) throw new Error("Model tidak mengembalikan daftar soal");
  return normalizeGeneratedQuestions(payload, result.questions.slice(0, count), plan);
}

async function streamGenerateQuestions(payload, onChunk) {
  const count = Number(payload.count || 5);
  const plan = createLearningOutcomeQuestionPlan(payload);
  const { content } = await streamOpenRouter(buildMessages(payload), SCHEMA, { tenantId: payload.tenantId, userId: payload.userId, action: "generate-questions" }, onChunk);
  const parsed = parseJson(content);
  if (!Array.isArray(parsed.questions)) throw new Error("Model tidak mengembalikan daftar soal");
  return normalizeGeneratedQuestions(payload, parsed.questions.slice(0, count), plan);
}

module.exports = { generateQuestions, streamGenerateQuestions, buildMessages, createLearningOutcomeQuestionPlan, normalizeQuestion, normalizeGeneratedQuestions, SINGLE_SUBSTANCE_RULES, ORAL_SCENARIO_RULES };
