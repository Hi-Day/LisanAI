const assert = require("node:assert/strict");
const test = require("node:test");

const {
  detectEvidenceGap,
  normalizeProbeResult,
  prepareProbingPayload,
} = require("../server/adaptive-probing");

test("empty answer targets conceptual clarity", () => {
  const gap = detectEvidenceGap("");
  assert.equal(gap.type, "conceptual_clarity");
  assert.equal(gap.confidence, 0.99);
});

test("answer without causal reasoning targets cause-effect evidence", () => {
  const gap = detectEvidenceGap("Fotosintesis terjadi pada tumbuhan dan menghasilkan glukosa.");
  assert.equal(gap.type, "causal_reasoning");
});

test("answer with reasoning but no concrete application targets application", () => {
  const gap = detectEvidenceGap("Hal ini terjadi karena energi cahaya digunakan dalam proses tersebut sehingga hasilnya berubah.");
  assert.equal(gap.type, "application");
});

test("adaptive payload preserves original answer and exposes evidence gap", () => {
  const payload = prepareProbingPayload({
    prompt: "Mengapa fotosintesis penting?",
    focus: "fotosintesis",
    outcomes: "Siswa mampu menjelaskan peran fotosintesis",
    answer: "Karena menghasilkan bahan yang dibutuhkan tumbuhan.",
  });

  assert.equal(payload.answer, "Karena menghasilkan bahan yang dibutuhkan tumbuhan.");
  assert.equal(payload.evidenceGap.type, "application");
  assert.match(payload.focus, /TARGET EVIDENCE GAP/);
  assert.match(payload.focus, /penerapan/);
});

test("normalized probe result carries gap metadata without changing the prompt", () => {
  const payload = prepareProbingPayload({
    prompt: "Jelaskan prosesnya.",
    focus: "proses",
    answer: "Karena faktor A memengaruhi faktor B.",
  });
  const probing = normalizeProbeResult({
    prompt: "Bagaimana hal itu terlihat pada kasus nyata?",
    focus: payload.focus,
    ideal: "Siswa mengaitkan konsep dengan kasus.",
  }, payload);

  assert.equal(probing.prompt, "Bagaimana hal itu terlihat pada kasus nyata?");
  assert.equal(probing.probeType, payload.evidenceGap.type);
  assert.ok(probing.evidenceGap);
  assert.equal(probing.stopRecommended, false);
});
