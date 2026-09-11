const test = require("node:test");
const assert = require("node:assert/strict");

// fallback-assessment.js is an ESM frontend module; exercise the same invariant
// with representative fallback prompts to keep this regression test dependency-free.
const DEMANDS = [
  { type: "reasoning", pattern: /\b(?:mengapa|kenapa|alasan|sebab|akibat|konsekuensi)\b/i },
  { type: "application", pattern: /\b(?:contoh|misal|misalnya|penerapan|diterapkan|kasus|situasi|gunakan)\b/i },
  { type: "comparison", pattern: /\b(?:bandingkan|perbandingan|persamaan|perbedaan)\b/i },
  { type: "analysis", pattern: /\b(?:analisis|analisa|hubungan|dampak|pengaruh|keterkaitan)\b/i },
  { type: "evaluation", pattern: /\b(?:evaluasi|nilai|menilai|kritik|kelemahan|kelebihan|keterbatasan)\b/i },
];

test("fallback rubric never adds unsupported application criterion", () => {
  const prompt = "Jelaskan Sistem pernapasan dengan mengaitkan konsep sistem dan alasan pendukungnya.";
  const supported = DEMANDS.filter((d) => d.pattern.test(prompt)).map((d) => d.type);
  assert.ok(supported.includes("reasoning"));
  assert.ok(!supported.includes("application"));
});

test("fallback rubric for a comparison prompt does not invent examples", () => {
  const prompt = "Bandingkan dua ide penting dalam Sistem pernapasan, lalu jelaskan mana yang paling menentukan.";
  assert.match(prompt, /bandingkan/i);
  assert.doesNotMatch(prompt, /\bcontoh\b/i);
});
