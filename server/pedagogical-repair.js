/**
 * AI-assisted repair for Question -> Criterion grounding issues.
 *
 * The repair policy deliberately gives the teacher control over the repair
 * strategy: rewrite the question, rebuild the rubric, or let AI decide per
 * issue. The model must never add evidence requests merely to satisfy a rubric.
 */

const { callOpenRouter, streamOpenRouter } = require("./openrouter");
const {
  groundQuestionsAgainstRubric,
  validateQuestionCriterionGrounding,
} = require("./harness/question-grounding");

const REPAIR_RULES = [
  "Pertahankan topik, learning outcome, dan substansi inti soal.",
  "Jangan menambahkan permintaan evidence hanya untuk membuat rubric terlihat cocok.",
  "Jika criterion memang penting untuk kompetensi dan dapat diminta tanpa mengubah soal menjadi multi-substansi, perbaiki pertanyaan agar evidence criterion itu eksplisit.",
  "Jika criterion tidak benar-benar dituntut oleh substansi pertanyaan, hapus criterion tersebut dari soal dan sesuaikan rubric agar hanya menilai evidence yang memang diminta.",
  "Setiap soal tetap satu substansi, satu tujuan utama, dan cocok untuk ujian lisan spontan.",
  "Jangan mengubah learning outcome hanya untuk menghilangkan masalah grounding.",
  "Pertahankan jumlah dan urutan soal.",
  "HANYA soal yang tercantum dalam masalah_grounding boleh berubah. Soal lain harus dikembalikan persis seperti input, termasuk prompt, focus, outcome, ideal, criteria, rubric, dan probing.",
].join(" ");

const SCHEMA = `Format JSON persis: {"questions":[{"prompt":"...","focus":"...","outcome":"...","rubric":"...","ideal":"...","criteria":[{"id":"...","name":"...","weight":40}]}]}. Jumlah dan urutan questions harus sama dengan input. HANYA soal yang disebut dalam masalah_grounding yang boleh berubah. Soal lain harus dikembalikan persis seperti input. criteria harus hanya berisi criterion yang benar-benar dapat dibuktikan oleh prompt. Bobot criterion yang tersisa harus berjumlah 100% untuk setiap soal.`;

function normalizeQuestions(questions) {
  return (Array.isArray(questions) ? questions : []).map((question, index) => ({
    ...question,
    id: question?.id || `q-${index}`,
    prompt: String(question?.prompt || "").trim(),
    focus: String(question?.focus || "").trim(),
    outcome: String(question?.outcome || "").trim(),
    rubric: String(question?.rubric || "").trim(),
    ideal: String(question?.ideal || "").trim(),
    criteria: Array.isArray(question?.criteria) ? question.criteria : [],
  }));
}

function affectedQuestionIndexes(payload = {}, length = 0) {
  const indexes = new Set();
  for (const issue of Array.isArray(payload.issues) ? payload.issues : []) {
    const index = Number(issue?.index ?? issue?.questionIndex);
    if (Number.isInteger(index) && index >= 0 && index < length) indexes.add(index);
  }
  return indexes;
}

/**
 * Hard boundary for repair scope. The AI response may contain all questions,
 * but only questions with an actual reported issue are allowed to replace the
 * original. This prevents an unrelated Soal 1 from appearing as a "change"
 * when only Soal 2 needs repair.
 */
function mergeOnlyAffectedQuestions(original, candidate, payload = {}) {
  const source = normalizeQuestions(original);
  const proposed = normalizeQuestions(candidate);
  if (proposed.length !== source.length) return source;
  const affected = affectedQuestionIndexes(payload, source.length);
  if (affected.size === 0) return source;

  return source.map((question, index) => affected.has(index)
    ? {
        ...question,
        ...proposed[index],
        id: question.id,
        probing: question.probing,
      }
    : question
  );
}

function buildMessages(payload, mode) {
  return [{
    role: "user",
    content: JSON.stringify({
      tugas: "Perbaiki masalah grounding antara pertanyaan dan rubric pada assessment lisan.",
      strategi: mode === "question"
        ? "REGENERATE_QUESTION: pertahankan criterion yang ada dan tulis ulang hanya pertanyaan yang bermasalah agar evidence criterion benar-benar diminta. Jangan menambah tugas kedua."
        : mode === "rubric"
          ? "REGENERATE_RUBRIC: pertahankan pertanyaan apa adanya semaksimal mungkin; sesuaikan criteria dan rubric agar hanya menilai evidence yang benar-benar diminta pertanyaan."
          : "AUTO: tentukan perbaikan terbaik per soal. Jika criterion merupakan bagian penting dari substansi/learning outcome, perbaiki pertanyaan. Jika tidak, sesuaikan rubric dengan menghapus criterion yang tidak dituntut.",
      topik: payload.topic || "",
      learning_outcome: payload.outcomes || "",
      aturan: REPAIR_RULES,
      masalah_grounding: payload.issues || [],
      questions: normalizeQuestions(payload.questions),
    }),
  }];
}

function parseRubricCriteria(text) {
  const value = String(text || "").trim();
  if (!value) return [];
  if (value.startsWith("{")) {
    try {
      const parsed = JSON.parse(value);
      if (parsed.version === "2" && Array.isArray(parsed.criteria)) return parsed.criteria;
    } catch { /* legacy rubric */ }
  }
  return value.split(/[;\n]+/).map((line) => {
    const match = line.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*%$/);
    return match ? { name: match[1].trim(), weight: Number(match[2]) } : { name: line.trim(), weight: 0 };
  }).filter((item) => item.name);
}

function normalizeCriteriaWeights(criteria) {
  const source = (Array.isArray(criteria) ? criteria : []).map((criterion) => ({
    ...criterion,
    name: String(criterion?.name || criterion?.id || "").trim(),
    weight: Number(criterion?.weight) || 0,
  })).filter((criterion) => criterion.name);
  if (!source.length) return [];
  const total = source.reduce((sum, criterion) => sum + criterion.weight, 0) || source.length;
  return source.map((criterion, index) => ({
    ...criterion,
    weight: index === source.length - 1
      ? Number((100 - source.slice(0, -1).reduce((sum, item) => sum + Math.round((item.weight / total) * 100), 0)).toFixed(2))
      : Number(((criterion.weight / total) * 100).toFixed(2)),
  }));
}

function rebuildRubricForCriteria(rubric, criteria) {
  const normalizedCriteria = normalizeCriteriaWeights(criteria);
  if (!normalizedCriteria.length) return "";

  const original = parseRubricCriteria(rubric);
  const names = new Set(normalizedCriteria.map((criterion) => criterion.name.toLowerCase()));
  const kept = original.filter((criterion) => names.has(String(criterion.name || "").trim().toLowerCase()));

  if (String(rubric).trim().startsWith("{") && kept.length) {
    try {
      const parsed = JSON.parse(rubric);
      if (parsed.version === "2") {
        const total = kept.reduce((sum, criterion) => sum + (Number(criterion.weight) || 0), 0) || kept.length;
        const normalized = kept.map((criterion, index) => ({
          ...criterion,
          weight: index === kept.length - 1
            ? Number((100 - kept.slice(0, -1).reduce((sum, item) => sum + Math.round(((Number(item.weight) || 0) / total) * 100), 0)).toFixed(2))
            : Number((((Number(criterion.weight) || 0) / total) * 100).toFixed(2)),
        }));
        return JSON.stringify({ ...parsed, criteria: normalized });
      }
    } catch { /* fall through to a clean rubric */ }
  }

  return normalizedCriteria.map((criterion) => `${criterion.name} ${criterion.weight}%`).join("\n");
}

function reconcileRubric(question) {
  if (!question) return question;
  const criteria = Array.isArray(question.criteria) ? question.criteria : [];
  return {
    ...question,
    rubric: rebuildRubricForCriteria(question.rubric, criteria),
  };
}

function fallbackRepair(questions, mode, payload) {
  const source = normalizeQuestions(questions);
  const grounded = groundQuestionsAgainstRubric(source, payload);
  const affected = affectedQuestionIndexes(payload, source.length);
  return source.map((question, index) => {
    if (!affected.has(index)) return question;
    return reconcileRubric(grounded[index]);
  });
}

function parseModelQuestions(content) {
  const trimmed = String(content || "").trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed)?.questions || null;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0])?.questions || null; } catch { return null; }
  }
}

async function streamRepairPedagogicalGrounding(payload = {}, onChunk) {
  const questions = normalizeQuestions(payload.questions);
  const affected = affectedQuestionIndexes(payload, questions.length);
  if (!questions.length || affected.size === 0) return { questions, repairedBy: "none" };

  try {
    const streamed = await streamOpenRouter(
      buildMessages({ ...payload, questions }, payload.mode || "auto"),
      SCHEMA,
      { tenantId: payload.tenantId, userId: payload.userId, action: "repair-pedagogical-grounding" },
      onChunk
    );
    const candidate = normalizeQuestions(parseModelQuestions(streamed.content));
    if (candidate.length !== questions.length) throw new Error("AI mengembalikan jumlah soal yang tidak sesuai.");
    const repaired = mergeOnlyAffectedQuestions(questions, candidate, payload);
    const stillInvalid = [...affected].some((index) => !validateQuestionCriterionGrounding(repaired[index]).valid);
    if (stillInvalid) return { questions: fallbackRepair(repaired, payload.mode || "auto", payload), repairedBy: "ai-plus-deterministic" };
    return { questions: repaired, repairedBy: "ai" };
  } catch (error) {
    console.error("Pedagogical repair streaming unavailable:", error.message);
    return { questions: fallbackRepair(questions, payload.mode || "auto", payload), repairedBy: "deterministic-fallback", streamError: error.message };
  }
}

async function repairPedagogicalGrounding(payload = {}) {
  const questions = normalizeQuestions(payload.questions);
  if (!questions.length) return { questions: [], repairedBy: "deterministic" };

  const affected = affectedQuestionIndexes(payload, questions.length);
  if (affected.size === 0) return { questions, repairedBy: "none" };

  let result = null;
  try {
    result = await callOpenRouter(
      buildMessages({ ...payload, questions }, payload.mode || "auto"),
      SCHEMA,
      { tenantId: payload.tenantId, userId: payload.userId, action: "repair-pedagogical-grounding" }
    );
  } catch (error) {
    console.error("Pedagogical repair AI unavailable:", error.message);
  }

  const candidate = normalizeQuestions(result?.questions);
  if (candidate.length !== questions.length) {
    return { questions: fallbackRepair(questions, payload.mode || "auto", payload), repairedBy: "deterministic-fallback" };
  }

  const repaired = mergeOnlyAffectedQuestions(questions, candidate, payload);
  const stillInvalid = [...affected].some((index) => !validateQuestionCriterionGrounding(repaired[index]).valid);
  if (stillInvalid) {
    return { questions: fallbackRepair(repaired, payload.mode || "auto", payload), repairedBy: "ai-plus-deterministic" };
  }

  return { questions: repaired, repairedBy: "ai" };
}

module.exports = {
  repairPedagogicalGrounding,
  streamRepairPedagogicalGrounding,
  rebuildRubricForCriteria,
  affectedQuestionIndexes,
  mergeOnlyAffectedQuestions,
};
