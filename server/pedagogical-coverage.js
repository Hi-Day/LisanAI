const { streamOpenRouter } = require("./openrouter");

const SCHEMA = 'Format: {"question":{"prompt":"...","focus":"...","outcome":"...","rubric":"indikator 40%\\nindikator 35%\\nindikator 25%","ideal":"...","criteria":["target criterion"]}}';

function buildMessages(payload) {
  return [{
    role: "user",
    content: JSON.stringify({
      tugas: "Buat SATU soal ujian lisan tambahan untuk menutup satu kriteria rubrik yang belum terukur.",
      topik: payload.topic,
      learning_outcome: payload.outcomes,
      kriteria_target: payload.criterion,
      soal_saat_ini: payload.questions || [],
      aturan: [
        "Soal tambahan harus secara eksplisit menuntut evidence untuk kriteria target.",
        "Tetap satu substansi dan satu pertanyaan.",
        "Jangan mengulang substansi soal yang sudah ada.",
        "Soal harus cocok untuk ujian lisan dan menuntut penjelasan/penalaran bila kriteria membutuhkannya.",
        "Field criteria hanya berisi kriteria target yang benar-benar diukur.",
        "Rubrik soal harus hanya menilai isi yang ditanyakan dan bobot total 100%.",
      ],
    }),
  }];
}

function normalizeQuestion(question, criterion) {
  if (!question || typeof question !== "object") return null;
  const prompt = String(question.prompt || "").trim();
  if (!prompt) return null;
  return {
    id: question.id || `q-ai-${Date.now()}`,
    prompt,
    focus: String(question.focus || criterion || "").trim(),
    outcome: String(question.outcome || "").trim(),
    rubric: String(question.rubric || "").trim(),
    ideal: String(question.ideal || "").trim(),
    criteria: [criterion],
  };
}

async function streamCoverageQuestion(payload, onChunk) {
  let raw = "";
  const result = await streamOpenRouter(
    buildMessages(payload),
    SCHEMA,
    (chunk) => {
      raw += String(chunk || "");
      onChunk?.(String(chunk || ""));
    },
    { tenantId: payload.tenantId, userId: payload.userId, action: "generate-question-for-uncovered-criterion" }
  );
  const question = normalizeQuestion(result?.question, payload.criterion);
  if (!question) throw new Error("AI tidak menghasilkan soal tambahan yang valid.");
  return question;
}

async function generateCoverageQuestion(payload) {
  const result = await streamCoverageQuestion(payload, null);
  return result;
}

module.exports = {
  streamCoverageQuestion,
  generateCoverageQuestion,
};
