/**
 * AI-assisted repair for Question -> Criterion grounding issues.
 *
 * The repair policy deliberately gives the teacher control over the repair
 * strategy: rewrite the question, rebuild the rubric, or let AI decide per
 * issue. The model must never add evidence requests merely to satisfy a rubric.
 */

const { callOpenRouter } = require("./openrouter");
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
].join(" ");

const SCHEMA = `Format JSON persis: {"questions":[{"prompt":"...","focus":"...","outcome":"...","rubric":"...","ideal":"...","criteria":[{"id":"...","name":"...","weight":40}]}]}. Jumlah dan urutan questions harus sama dengan input. criteria harus hanya berisi criterion yang benar-benar dapat dibuktikan oleh prompt. Bobot criterion yang tersisa harus berjumlah 100% untuk setiap soal.`;

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

function rebuildRubricForCriteria(rubric, criteria) {
  const original = parseRubricCriteria(rubric);
  if (!original.length) return rubric;
  const names = new Set(criteria.map((criterion) => String(criterion?.name || criterion?.id || "").trim().toLowerCase()));
  const kept = original.filter((criterion) => names.has(String(criterion.name || "").trim().toLowerCase()));
  if (!kept.length) return rubric;
  const total = kept.reduce((sum, criterion) => sum + (Number(criterion.weight) || 0), 0) || kept.length;
  const normalized = kept.map((criterion, index) => ({
    ...criterion,
    weight: index === kept.length - 1
      ? Number((100 - kept.slice(0, -1).reduce((sum, item) => sum + Math.round(((Number(item.weight) || 0) / total) * 100), 0)).toFixed(2))
      : Number((((Number(criterion.weight) || 0) / total) * 100).toFixed(2)),
  }));
  if (String(rubric).trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(rubric);
      if (parsed.version === "2") return JSON.stringify({ ...parsed, criteria: normalized });
    } catch { /* keep original */ }
  }
  return normalized.map((criterion) => `${criterion.name} ${criterion.weight}%`).join("\n");
}

function fallbackRepair(questions, mode, payload) {
  const grounded = groundQuestionsAgainstRubric(questions, payload);
  if (mode === "question") return grounded.map((question) => ({ ...question }));
  return grounded.map((question) => ({
    ...question,
    rubric: rebuildRubricForCriteria(question.rubric, question.criteria),
  }));
}

async function repairPedagogicalGrounding(payload = {}) {
  const questions = normalizeQuestions(payload.questions);
  if (!questions.length) return { questions: [], repairedBy: "deterministic" };

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

  const repaired = candidate.map((question, index) => ({
    ...questions[index],
    ...question,
    id: questions[index].id,
    probing: questions[index].probing,
  }));

  const stillInvalid = repaired.some((question) => !validateQuestionCriterionGrounding(question).valid);
  if (stillInvalid) {
    return { questions: fallbackRepair(repaired, payload.mode || "auto", payload), repairedBy: "ai-plus-deterministic" };
  }

  return { questions: repaired, repairedBy: "ai" };
}

module.exports = { repairPedagogicalGrounding, rebuildRubricForCriteria };
