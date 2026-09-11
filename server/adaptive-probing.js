/** Lightweight evidence-gap engine for oral assessment probing. */
const GAP_RULES = [
  { type: "conceptual_clarity", label: "kejelasan konsep", missing: (a) => a.length < 45, probe: "minta siswa memperjelas makna konsep dengan bahasa sendiri" },
  { type: "causal_reasoning", label: "alasan atau sebab-akibat", missing: (a) => !/\b(karena|sebab|mengapa|kenapa|akibat|sehingga|maka|oleh karena)\b/i.test(a), probe: "minta siswa menjelaskan alasan atau hubungan sebab-akibat" },
  { type: "application", label: "penerapan pada situasi", missing: (a) => !/\b(contoh|misal|misalnya|kasus|situasi|penerapan|diterapkan)\b/i.test(a), probe: "minta siswa menerapkan gagasannya pada satu situasi konkret" },
  { type: "evidence", label: "bukti atau dasar", missing: (a) => !/\b(bukti|data|fakta|dasar|indikator|observasi|menunjukkan)\b/i.test(a), probe: "minta siswa menyebutkan dasar atau bukti yang mendukung jawabannya" },
  { type: "alternative_reasoning", label: "alternatif atau batasan", missing: (a) => !/\b(namun|tetapi|sebaliknya|berbeda|kondisi|batas|kelemahan|alternatif)\b/i.test(a), probe: "minta siswa mempertimbangkan kondisi atau sudut pandang alternatif" },
];
function normalizeAnswer(answer) { return String(answer || "").replace(/\s+/g, " ").trim(); }
function detectEvidenceGap(answer) {
  const text = normalizeAnswer(answer);
  if (!text) return { type: "conceptual_clarity", label: "kejelasan konsep", confidence: 0.99, rationale: "Belum ada jawaban yang dapat digunakan sebagai bukti.", probe: "minta siswa menjelaskan satu ide utama dengan bahasa sendiri" };
  const candidate = GAP_RULES.find((rule) => rule.missing(text));
  if (candidate) return { type: candidate.type, label: candidate.label, confidence: 0.78, rationale: `Jawaban belum menunjukkan bukti yang cukup untuk ${candidate.label}.`, probe: candidate.probe };
  return { type: "alternative_reasoning", label: "ketahanan penalaran", confidence: 0.64, rationale: "Jawaban sudah memuat beberapa bukti dasar; langkah berikutnya adalah menguji penalarannya pada kondisi berbeda.", probe: "uji apakah alasan siswa tetap berlaku pada kondisi atau sudut pandang lain" };
}
function buildAdaptiveFocus(payload, gap) { return [String(payload.focus || payload.outcomes || "pemahaman").trim(), `TARGET EVIDENCE GAP: ${gap.label}.`, `TUJUAN PROBING: ${gap.probe}.`, "Jangan memperluas substansi soal utama."].join(" "); }
function prepareProbingPayload(payload) { const gap = detectEvidenceGap(payload.answer); return { ...payload, focus: buildAdaptiveFocus(payload, gap), evidenceGap: gap }; }
function normalizeProbeResult(probing, payload) {
  const gap = payload.evidenceGap || detectEvidenceGap(payload.answer);
  return { ...probing, evidenceGap: gap, probeType: gap.type, rationale: gap.rationale, stopRecommended: false, baselineScore: Number.isFinite(Number(payload.baselineScore)) ? Number(payload.baselineScore) : null, baselineEvidence: Array.isArray(payload.baselineEvidence) ? payload.baselineEvidence : [], baselineEvaluationId: payload.baselineEvaluationId || null, baselineEvaluationRunId: payload.baselineEvaluationRunId || null };
}
module.exports = { detectEvidenceGap, normalizeProbeResult, prepareProbingPayload };
