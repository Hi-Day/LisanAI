const { call: callOpenRouter, stream: streamOpenRouter } = require("../ai/gateway");

const SCHEMA = 'Format: {"outcomes":"3-5 learning outcome dalam baris terpisah"}';
function buildMessages(payload) {
  return [{ role: "user", content: JSON.stringify({
    tugas: "Buat rekomendasi capaian pembelajaran (learning outcome) untuk assessment lisan.",
    topik: payload.topic,
    tingkat_kesulitan: payload.difficulty || "Menengah",
    konteks: "Guru akan memakai rekomendasi capaian pembelajaran ini untuk membuat soal evaluasi lisan siswa. Gunakan bahasa Indonesia yang ringkas, operasional, dan bisa langsung diedit guru.",
  }) }];
}
async function recommendAssessmentConfig(payload) {
  const result = await callOpenRouter(buildMessages(payload), SCHEMA, { tenantId: payload.tenantId, userId: payload.userId, action: "recommend-assessment-config" });
  return { outcomes: String(result.outcomes || "").trim() };
}
async function streamRecommendAssessmentConfig(payload, onChunk) {
  const { content } = await streamOpenRouter(buildMessages(payload), SCHEMA, { tenantId: payload.tenantId, userId: payload.userId, action: "recommend-assessment-config" }, onChunk);
  let parsed;
  try { parsed = JSON.parse(content.trim()); } catch { const match = content.trim().match(/\{[\s\S]*\}/); parsed = match ? JSON.parse(match[0]) : {}; }
  return { outcomes: String(parsed.outcomes || "").trim() };
}
module.exports = { recommendAssessmentConfig, streamRecommendAssessmentConfig, buildMessages, SCHEMA };