// Token metadata is not consumed here: only the accumulated raw text matters,
// so the gateway (which also owns provider fallback + telemetry) is enough.
const { stream } = require("./ai/gateway");

const DEFAULT_COUNT = 3;
const FOCUSES = [
  "pemahaman konsep inti",
  "analisis hubungan dan penerapan",
  "penalaran dan komunikasi lisan",
];

function buildMessages(payload, index) {
  const existing = Array.isArray(payload.existingOutcomes) ? payload.existingOutcomes : [];
  return [{
    role: "user",
    content: JSON.stringify({
      tugas: "Buat tepat SATU learning outcome untuk assessment lisan.",
      topik: String(payload.topic || "").trim(),
      kompetensi_awal: String(payload.outcomes || "").trim(),
      capaian_sudah_ada: existing,
      fokus: FOCUSES[index] || "pemahaman yang dapat dibuktikan",
      aturan: [
        "Learning outcome harus berupa kemampuan siswa yang dapat dibuktikan.",
        "Gunakan satu verba operasional utama.",
        "Jangan menggabungkan beberapa kemampuan menjadi satu outcome.",
        "Harus spesifik terhadap topik dan cocok untuk ujian lisan.",
        "Jangan menulis nomor, bullet, atau penjelasan tambahan.",
        existing.length ? "Jangan mengulang capaian yang sudah ada." : "",
      ].filter(Boolean),
    }),
  }];
}

const SCHEMA = 'Format: {"outcome":"..."}. Hanya satu outcome.';

function fallbackOutcome(topic, index, existing = []) {
  const candidates = [
    `Siswa mampu menjelaskan konsep inti ${topic} dengan bahasa sendiri.`,
    `Siswa mampu menganalisis hubungan antar konsep pada ${topic}.`,
    `Siswa mampu menyampaikan alasan dan penerapan konsep ${topic} secara runtut.`,
  ];
  const used = new Set(existing.map((x) => String(x).trim().toLowerCase()));
  // Concurrent recommendations share the same `existing` list, so each index
  // claims its own candidate first; otherwise every slot would return the same
  // fallback outcome.
  const preferred = candidates[index % candidates.length];
  if (!used.has(preferred.toLowerCase())) return preferred;
  return candidates.find((x) => !used.has(x.toLowerCase())) || `Siswa mampu menjelaskan aspek penting ${topic} secara runtut.`;
}

function extractOutcome(content) {
  try {
    const parsed = JSON.parse(String(content || ""));
    return String(parsed.outcome || "").replace(/^\s*\d+[.)]\s*/, "").trim();
  } catch {
    return String(content || "").replace(/^\s*\d+[.)]\s*/, "").trim();
  }
}

async function generateOne(payload, index, onChunk) {
  const existing = Array.isArray(payload.existingOutcomes) ? payload.existingOutcomes : [];
  if (payload.mock === true) {
    const outcome = fallbackOutcome(payload.topic, index, existing);
    for (const chunk of outcome.match(/.{1,18}(?:\s|$)/g) || [outcome]) {
      onChunk?.(chunk);
      await new Promise((resolve) => setTimeout(resolve, 18));
    }
    return outcome;
  }

  let raw = "";
  await stream(
    buildMessages(payload, index),
    SCHEMA,
    { tenantId: payload.tenantId, userId: payload.userId, action: "recommend-learning-outcome" },
    (chunk) => {
      raw += String(chunk || "");
      onChunk?.(extractOutcome(raw));
    }
  );
  const outcome = extractOutcome(raw);
  return outcome || fallbackOutcome(payload.topic, index, existing);
}

/**
 * Generates up to three independent outcomes concurrently. Default is exactly
 * three; callers may request one for the explicit "+ Tambah dengan AI" action.
 */
async function streamLearningOutcomes(payload, onEvent) {
  const count = Math.min(DEFAULT_COUNT, Math.max(1, Number(payload.count) || DEFAULT_COUNT));
  const existing = Array.isArray(payload.existingOutcomes) ? payload.existingOutcomes.filter(Boolean) : [];
  const results = Array(count).fill(null);

  const jobs = Array.from({ length: count }, (_, index) => (async () => {
    onEvent?.({ type: "outcome-start", index });
    try {
      const outcome = await generateOne({ ...payload, existingOutcomes: existing }, index, (text) => {
        onEvent?.({ type: "outcome-chunk", index, text });
      });
      results[index] = outcome;
      onEvent?.({ type: "outcome-result", index, outcome });
      return { index, outcome };
    } catch (error) {
      const outcome = fallbackOutcome(payload.topic, index, existing);
      results[index] = outcome;
      onEvent?.({ type: "outcome-error", index, error: error.message, outcome });
      return { index, outcome, error: error.message };
    }
  })());

  await Promise.all(jobs);
  return results.filter(Boolean).slice(0, count);
}

async function recommendLearningOutcomes(payload) {
  const count = Math.min(DEFAULT_COUNT, Math.max(1, Number(payload.count) || DEFAULT_COUNT));
  const results = await Promise.all(
    Array.from({ length: count }, (_, index) => generateOne({ ...payload, existingOutcomes: payload.existingOutcomes || [] }, index))
  );
  return results.slice(0, count);
}

module.exports = {
  DEFAULT_COUNT,
  streamLearningOutcomes,
  recommendLearningOutcomes,
};
