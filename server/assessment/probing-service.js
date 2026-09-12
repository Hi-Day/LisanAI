const { call: callOpenRouter, stream: streamOpenRouter } = require("./ai/gateway");
const { parseJson } = require("./ai/response-parser");

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
  return {
    prompt: String(result.prompt || "").trim(),
    focus,
    ideal: String(result.ideal || "").trim(),
    outcomes: String(payload.outcomes || "").trim(),
  };
}

async function generateProbing(payload) {
  const result = await callOpenRouter(buildProbingMessages(payload), PROBING_SCHEMA, {
    tenantId: payload.tenantId,
    userId: payload.userId,
    action: "generate-probing",
  });
  return normalizeProbing(result, payload);
}

async function streamProbing(payload, onChunk) {
  const { content } = await streamOpenRouter(buildProbingMessages(payload), PROBING_SCHEMA, {
    tenantId: payload.tenantId,
    userId: payload.userId,
    action: "generate-probing",
  }, onChunk);
  return normalizeProbing(parseJson(content), payload);
}

module.exports = {
  buildProbingMessages,
  generateProbing,
  normalizeProbing,
  streamProbing,
};
