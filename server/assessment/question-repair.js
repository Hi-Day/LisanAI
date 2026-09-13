const { call: callOpenRouter, stream: streamOpenRouter } = require("../ai/gateway");
const { parseJson } = require("../ai/response-parser");
const { enforceRubricAlignment } = require("../harness/alignment");
const { SINGLE_SUBSTANCE_RULES, ORAL_SCENARIO_RULES } = require("./question-generation");

const TASK_VERB_PATTERN = /\b(?:jelaskan|sebutkan|berikan|evaluasi|usulkan|uraikan|bandingkan|analisis|tuliskan|simpulkan|gambarkan|deskripsikan|terangkan|buktikan|hitung|identifikasi|kategorikan|rancang|ceritakan|tunjukkan)\w*/i;
const MULTI_TASK_CONNECTOR_PATTERN = /\b(?:serta|kemudian|lalu|terakhir|selanjutnya|berikutnya|di samping itu|selain itu|dan|juga)\b(?=[^.!?\n]*(?:jelaskan|sebutkan|berikan|evaluasi|usulkan|uraikan|bandingkan|analisis|tuliskan|simpulkan|gambarkan|deskripsikan|terangkan|buktikan|hitung|identifikasi|kategorikan|rancang|ceritakan|tunjukkan))/i;
const CLOSED_QUESTION_PATTERN = /\b(?:apakah|benarkah|betulkah|adakah|berapakah)\b|^(?:berapa|siapa|kapan|dimana|di mana)\b/i;
const RECALL_ONLY_PATTERN = /\b(?:definisi|pengertian|arti|cirinya|macam-macam|pengertian dari)\b/i;
const REASONING_PATTERN = /\b(?:jelaskan|mengapa|kenapa|bandingkan|evaluasi|analisis|uraikan|usulkan|buktikan|prediksi|perkirakan|bagaimana|cara|proses|alasan|akibat|pengaruh|kaitannya)\b/i;

function isMultiPartPrompt(prompt) {
  const text = String(prompt || "").trim();
  if (!text) return false;
  if ((text.match(/\d+[\.\)]/g) || []).length > 1 || (text.match(/\?/g) || []).length > 1) return true;
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let taskCount = 0;
  for (const sentence of sentences) {
    const verbs = sentence.match(TASK_VERB_PATTERN) || [];
    if (verbs.length > 1) return true;
    if (verbs.length === 1 || sentence.includes("?")) taskCount += 1;
    if (taskCount > 1 || MULTI_TASK_CONNECTOR_PATTERN.test(sentence)) return true;
  }
  return false;
}
function isClosedRecallQuestion(prompt) {
  const text = String(prompt || "").trim().toLowerCase();
  if (!text) return false;
  return (CLOSED_QUESTION_PATTERN.test(text) && !REASONING_PATTERN.test(text)) || (RECALL_ONLY_PATTERN.test(text) && !REASONING_PATTERN.test(text));
}
function ensureSentenceEnding(text) { const t = String(text || "").trim(); return /[.!?]$/.test(t) ? t : `${t}.`; }
function stripToSingleSubstance(prompt) {
  let text = String(prompt || "").trim();
  if (!isMultiPartPrompt(text)) return text;
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  if (sentences.length > 1) {
    const firstTask = sentences.findIndex((s) => s.includes("?") || TASK_VERB_PATTERN.test(s));
    if (firstTask >= 0) {
      const candidate = sentences.slice(0, firstTask + 1).join(" ").trim();
      if (!isMultiPartPrompt(candidate)) return ensureSentenceEnding(candidate);
      text = candidate;
    }
  }
  const cut = text.match(MULTI_TASK_CONNECTOR_PATTERN);
  if (cut) {
    const candidate = text.slice(0, cut.index).trim();
    const lastToken = candidate.split(/\s+/).pop() || "";
    if (candidate.length > 4 && !TASK_VERB_PATTERN.test(lastToken) && !/^(?:serta|kemudian|lalu|terakhir|selanjutnya|berikutnya|dan|juga|di)$/i.test(lastToken)) return ensureSentenceEnding(candidate);
  }
  return ensureSentenceEnding(text);
}
function openClosedQuestion(prompt) {
  const text = String(prompt || "").trim();
  if (!isClosedRecallQuestion(text)) return text;
  if (/^apakah\b/i.test(text)) return ensureSentenceEnding(text.replace(/^apakah\b/i, "Mengapa"));
  if (RECALL_ONLY_PATTERN.test(text.toLowerCase())) return ensureSentenceEnding(`Jelaskan dengan kata-katamu sendiri dan sertakan alasanmu: ${text}`);
  return ensureSentenceEnding(`Bagaimana dan mengapa: ${text}`);
}

const REPAIR_SCHEMA = 'Format: {"questions":[{"prompt":"...","focus":"...","ideal":"..."}]}. Jumlah dan urutan questions HARUS sama dengan input.';
const ORAL_SCHEMA = REPAIR_SCHEMA;

async function repairSingleSubstance(questions, payload) {
  const flagged = (questions || []).map((q, i) => isMultiPartPrompt(q.prompt) ? i : -1).filter((i) => i >= 0);
  if (!flagged.length) return questions;
  const messages = [{ role: "user", content: JSON.stringify({ tugas: "Tulis ulang soal agar hanya menanyakan SATU substansi. Pertahankan esensi pertanyaan.", topik: payload.topic, learning_outcome: payload.outcomes, aturan: SINGLE_SUBSTANCE_RULES, jumlah_dan_urutan_hasil: "harus sama persis dengan jumlah input", questions_bertingkat: flagged.map((i) => String(questions[i].prompt)) }) }];
  let repaired;
  try { repaired = await callOpenRouter(messages, REPAIR_SCHEMA, { tenantId: payload.tenantId, userId: payload.userId, action: "repair-questions" }); } catch (error) { console.warn("[assessment-repair] AI repair failed:", error.message); }
  if (Array.isArray(repaired?.questions)) flagged.forEach((index, pos) => { const r = repaired.questions[pos]; if (r && !isMultiPartPrompt(r.prompt)) questions[index] = { ...questions[index], prompt: String(r.prompt).trim(), focus: String(r.focus || questions[index].focus || "").trim(), ideal: String(r.ideal || questions[index].ideal || "").trim() }; });
  questions.forEach((q) => { if (isMultiPartPrompt(q.prompt)) q.prompt = stripToSingleSubstance(q.prompt); });
  return questions;
}

async function repairOralScenario(questions, payload) {
  const flagged = (questions || []).map((q, i) => isClosedRecallQuestion(q.prompt) ? i : -1).filter((i) => i >= 0);
  if (!flagged.length) return questions;
  const messages = [{ role: "user", content: JSON.stringify({ tugas: "Tulis ulang soal tertutup/hafalan agar cocok untuk ujian lisan yang mengukur proses berpikir spontan.", topik: payload.topic, learning_outcome: payload.outcomes, aturan: ORAL_SCENARIO_RULES, jumlah_dan_urutan_hasil: "harus sama persis dengan jumlah input", questions_tertutup: flagged.map((i) => String(questions[i].prompt)) }) }];
  let repaired;
  try { repaired = await callOpenRouter(messages, ORAL_SCHEMA, { tenantId: payload.tenantId, userId: payload.userId, action: "repair-questions-oral" }); } catch (error) { console.warn("[assessment-repair] oral repair failed:", error.message); }
  if (Array.isArray(repaired?.questions)) flagged.forEach((index, pos) => { const r = repaired.questions[pos]; if (!r) return; const prompt = String(r.prompt || "").trim(); if (!isClosedRecallQuestion(prompt) && !isMultiPartPrompt(prompt)) questions[index] = { ...questions[index], prompt, focus: String(r.focus || questions[index].focus || "").trim(), ideal: String(r.ideal || questions[index].ideal || "").trim() }; });
  questions.forEach((q) => { if (isClosedRecallQuestion(q.prompt)) q.prompt = openClosedQuestion(q.prompt); });
  return questions;
}

async function improveQuestionSet(payload) {
  const result = await callOpenRouter([{ role: "user", content: JSON.stringify({ tugas: "Perbaiki question set assessment lisan agar lebih jelas, selaras dengan learning outcome dan rubrik, serta tetap sesuai tingkat kesulitan.", aturan_perbaikan: SINGLE_SUBSTANCE_RULES, assessment_config: payload.config, questions: payload.questions }) }], REPAIR_SCHEMA, { tenantId: payload.config?.tenantId || payload.tenantId, userId: payload.config?.userId || payload.userId, action: "improve-questions" });
  if (!Array.isArray(result.questions)) throw new Error("Model tidak mengembalikan daftar soal");
  let questions = result.questions.map((q, i) => ({ id: String(q.id || `q-ai-${Date.now()}-${i}`), prompt: String(q.prompt || "").trim(), focus: String(q.focus || "").trim(), outcome: String(q.outcome || payload.config?.outcomes || "").trim(), rubric: String(q.rubric || "").trim(), ideal: String(q.ideal || "").trim(), criteria: Array.isArray(q.criteria) ? q.criteria.map(String) : [] }));
  const config = payload.config || payload;
  questions = await repairSingleSubstance(questions, config);
  questions = await repairOralScenario(questions, config);
  return enforceRubricAlignment(questions, config);
}

async function streamImproveQuestionSet(payload, onChunk) {
  const { content } = await streamOpenRouter([{ role: "user", content: JSON.stringify({ tugas: "Perbaiki question set assessment lisan agar lebih jelas, selaras dengan learning outcome dan rubrik, serta tetap sesuai tingkat kesulitan.", aturan_perbaikan: SINGLE_SUBSTANCE_RULES, assessment_config: payload.config, questions: payload.questions }) }], REPAIR_SCHEMA, { tenantId: payload.config?.tenantId || payload.tenantId, userId: payload.config?.userId || payload.userId, action: "improve-questions" }, onChunk);
  const parsed = parseJson(content);
  if (!Array.isArray(parsed.questions)) throw new Error("Model tidak mengembalikan daftar soal");
  const config = payload.config || payload;
  let questions = parsed.questions.map((q, i) => ({ id: String(q.id || `q-ai-${Date.now()}-${i}`), prompt: String(q.prompt || "").trim(), focus: String(q.focus || "").trim(), outcome: String(q.outcome || config.outcomes || "").trim(), rubric: String(q.rubric || "").trim(), ideal: String(q.ideal || "").trim(), criteria: Array.isArray(q.criteria) ? q.criteria.map(String) : [] }));
  questions = await repairSingleSubstance(questions, config); questions = await repairOralScenario(questions, config);
  return enforceRubricAlignment(questions, config);
}

module.exports = { isMultiPartPrompt, isClosedRecallQuestion, isOpenOralQuestion: (p) => !isClosedRecallQuestion(p), stripToSingleSubstance, openClosedQuestion, repairSingleSubstance, repairOralScenario, improveQuestionSet, streamImproveQuestionSet };