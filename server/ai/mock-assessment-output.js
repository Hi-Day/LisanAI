function parsePrompt(prompt) {
  try { return JSON.parse(String(prompt || "")); } catch { return {}; }
}

function outcomeFor(topic, index) {
  const candidates = [
    `Siswa mampu menjelaskan konsep inti ${topic || "materi"} dengan bahasa sendiri.`,
    `Siswa mampu menganalisis hubungan antar konsep pada ${topic || "materi"}.`,
    `Siswa mampu menyampaikan alasan dan penerapan konsep ${topic || "materi"} secara runtut.`,
  ];
  return candidates[index % candidates.length];
}

function questionsFor(payload) {
  const count = Math.max(1, Math.min(20, Number(payload.jumlah_soal) || 5));
  const topic = String(payload.topik || "materi").trim();
  const outcome = String(payload.learning_outcome || "Siswa mampu menjelaskan konsep yang dipelajari.").trim();
  return Array.from({ length: count }, (_, index) => ({
    prompt: `Jelaskan konsep ${topic} dan berikan alasan atas penerapannya dalam situasi nyata.`,
    focus: topic,
    outcome,
    rubric: "Ketepatan konsep: 40%\nKesesuaian dengan learning outcome: 30%\nEvidence yang diminta: 20%\nKejelasan jawaban: 10%",
    ideal: `Jawaban menunjukkan pemahaman yang tepat tentang ${topic} dan alasan penerapannya.`,
    criteria: [],
    index,
  }));
}

function generateAssessmentOutput(request) {
  const payload = parsePrompt(request.prompt);
  if (request.action === "recommend-learning-outcome") {
    const topic = String(payload.topik || "materi").trim();
    return JSON.stringify({ outcome: outcomeFor(topic, 0) });
  }
  if (request.action === "generate-questions") {
    return JSON.stringify({ questions: questionsFor(payload) });
  }
  if (request.action === "recommend-assessment-config") {
    return JSON.stringify({ recommendation: { count: 5, difficulty: "Menengah" } });
  }
  return null;
}

module.exports = { generateAssessmentOutput };