const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

process.env.TURSO_DATABASE_URL = `file:${path.join(os.tmpdir(), `oralai-assessment-${Date.now()}.db`)}`;
process.env.ENABLE_DEMO_SIMULATION = "false";

const { initDatabase } = require("../server/database");
const assessmentService = require("../server/assessment-service");

let originalFetch;
let originalApiKey;

test.before(async () => {
  const dbPath = process.env.TURSO_DATABASE_URL.replace(/^file:/, "");
  fs.rmSync(dbPath, { force: true });
  await initDatabase();
});

test.beforeEach(() => {
  originalFetch = global.fetch;
  originalApiKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-key";
});

test.afterEach(() => {
  global.fetch = originalFetch;
  process.env.OPENROUTER_API_KEY = originalApiKey;
});

function mockOpenRouter(responseBody) {
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(responseBody) } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }),
  });
}

test("generateQuestions returns normalized questions matching the requested count", async () => {
  mockOpenRouter({
    questions: [
      { prompt: "Soal 1", focus: "Fokus 1", ideal: "Ideal 1" },
      { prompt: "Soal 2", focus: "Fokus 2", ideal: "Ideal 2" },
      { prompt: "Soal 3", focus: "Fokus 3", ideal: "Ideal 3" },
    ],
  });

  const questions = await assessmentService.generateQuestions({
    topic: "Fotosintesis",
    outcomes: "Memahami fotosintesis",
    rubric: "Akurasi 40%, Kelengkapan 60%",
    difficulty: "Menengah",
    count: 3,
    tenantId: "tenant-1",
    userId: "user-1",
  });

  assert.equal(questions.length, 3);
  assert.equal(questions[0].prompt, "Soal 1");
  assert.equal(questions[0].focus, "Fokus 1");
  assert.ok(questions[0].id.startsWith("q-ai-"));
});

test("generateQuestions slices results to the requested count", async () => {
  mockOpenRouter({
    questions: [
      { prompt: "A" },
      { prompt: "B" },
      { prompt: "C" },
      { prompt: "D" },
      { prompt: "E" },
    ],
  });

  const questions = await assessmentService.generateQuestions({
    topic: "T",
    count: 2,
    tenantId: "tenant-1",
    userId: "user-1",
  });

  assert.equal(questions.length, 2);
});

test("generateQuestions throws when the model returns no questions array", async () => {
  mockOpenRouter({});
  await assert.rejects(
    () => assessmentService.generateQuestions({ topic: "T", count: 1 }),
    /tidak mengembalikan daftar soal/
  );
});

test("evaluateAnswers clamps scores to 0-100 and attaches answers", async () => {
  mockOpenRouter({
    finalScore: 150,
    feedback: "Bagus",
    questionScores: [
      { question: "Q1", score: 120, matched: ["konsep"], strengths: ["lancar"], gaps: [] },
      { question: "Q2", score: -10, matched: [], strengths: [], gaps: ["kurang"] },
    ],
  });

  const result = await assessmentService.evaluateAnswers({
    assessment: {
      topic: "T",
      rubric: "R",
      outcomes: "O",
      questions: [{ prompt: "Q1" }, { prompt: "Q2" }],
    },
    answers: ["Jawaban 1", "Jawaban 2"],
    studentName: "Siswa",
    tenantId: "tenant-1",
    userId: "user-1",
  });

  assert.equal(result.finalScore, 100); // clamped from 150
  assert.equal(result.questionScores[0].score, 100); // clamped
  assert.equal(result.questionScores[1].score, 0); // clamped from -10
  assert.equal(result.questionScores[0].answer, "Jawaban 1");
  assert.equal(result.questionScores[1].answer, "Jawaban 2");
});

test("evaluateAnswers throws when questionScores is missing", async () => {
  mockOpenRouter({ finalScore: 80 });
  await assert.rejects(
    () =>
      assessmentService.evaluateAnswers({
        assessment: { questions: [{ prompt: "Q1" }] },
        answers: ["A"],
      }),
    /tidak mengembalikan penilaian per soal/
  );
});

test("recommendAssessmentConfig returns trimmed outcomes and rubric", async () => {
  mockOpenRouter({
    outcomes: "  1. Outcome A\n2. Outcome B  ",
    rubric: "  Akurasi 50%\nKelengkapan 50%  ",
  });

  const result = await assessmentService.recommendAssessmentConfig({
    topic: "T",
    difficulty: "Menengah",
    tenantId: "tenant-1",
    userId: "user-1",
  });

  assert.equal(result.outcomes, "1. Outcome A\n2. Outcome B");
  assert.equal(result.rubric, "Akurasi 50%\nKelengkapan 50%");
});

test("improveQuestionSet returns normalized questions", async () => {
  mockOpenRouter({
    questions: [{ prompt: "Perbaikan 1", focus: "F", ideal: "I" }],
  });

  const result = await assessmentService.improveQuestionSet({
    config: { topic: "T", tenantId: "tenant-1", userId: "user-1" },
    questions: [{ prompt: "Asli 1" }],
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].prompt, "Perbaikan 1");
});

test("isMultiPartPrompt flags bertingkat questions but allows context + single task", () => {
  const bertingkat =
    "Jelaskan interaksi antara komponen biotik dan abiotik dalam sebuah ekosistem hutan hujan tropis. Berikan contoh spesifik bagaimana produsen, konsumen, dan dekomposer saling bergantung, serta evaluasi dampak penebangan liar terhadap keseimbangan ekosistem tersebut. Terakhir, usulkan satu solusi sederhana yang dapat dilakukan masyarakat lokal untuk menjaga kelestarian ekosistem hutan hujan tropis.";
  assert.equal(assessmentService.isMultiPartPrompt(bertingkat), true);
  assert.equal(
    assessmentService.isMultiPartPrompt("Jelaskan X. Berikan contoh Y. Terakhir, usulkan solusi Z."),
    true
  );
  assert.equal(assessmentService.isMultiPartPrompt("Jelaskan X serta evaluasi dampaknya terhadap Y."), true);
  assert.equal(assessmentService.isMultiPartPrompt("Apa itu fotosintesis? Bagaimana prosesnya berlangsung?"), true);
  assert.equal(assessmentService.isMultiPartPrompt("1. Jelaskan X. 2. Berikan contoh Y."), true);

  assert.equal(
    assessmentService.isMultiPartPrompt(
      "Ekosistem hutan hujan tropis terdiri atas komponen biotik dan abiotik yang saling berinteraksi. Jelaskan bentuk interaksi antara keduanya."
    ),
    false
  );
  assert.equal(assessmentService.isMultiPartPrompt("Jelaskan proses terjadinya fotosintesis pada tumbuhan."), false);
  assert.equal(assessmentService.isMultiPartPrompt("Jelaskan peran dekomposer dalam ekosistem hutan hujan tropis."), false);
});

test("stripToSingleSubstance keeps only the first substance", () => {
  const bertingkat =
    "Jelaskan interaksi antara komponen biotik dan abiotik dalam sebuah ekosistem hutan hujan tropis. Berikan contoh spesifik bagaimana produsen, konsumen, dan dekomposer saling bergantung, serta evaluasi dampak penebangan liar terhadap keseimbangan ekosistem tersebut. Terakhir, usulkan satu solusi sederhana yang dapat dilakukan masyarakat lokal untuk menjaga kelestarian ekosistem hutan hujan tropis.";
  assert.equal(
    assessmentService.stripToSingleSubstance(bertingkat),
    "Jelaskan interaksi antara komponen biotik dan abiotik dalam sebuah ekosistem hutan hujan tropis."
  );
  assert.equal(assessmentService.stripToSingleSubstance("Jelaskan X. Berikan contoh Y."), "Jelaskan X.");
  assert.equal(assessmentService.stripToSingleSubstance("Jelaskan X serta evaluasi dampaknya."), "Jelaskan X.");
  assert.equal(
    assessmentService.stripToSingleSubstance("Soal tunggal biasa tanpa beberapa tugas."),
    "Soal tunggal biasa tanpa beberapa tugas."
  );
});

test("generateQuestions repairs bertingkat questions into single substance", async () => {
  const bertingkat = "Jelaskan X. Berikan contoh Y. Terakhir, usulkan solusi Z.";
  mockOpenRouter({
    questions: [{ prompt: bertingkat, focus: "Fokus 1", ideal: "Ideal 1" }],
  });

  const questions = await assessmentService.generateQuestions({
    topic: "T",
    count: 1,
    tenantId: "tenant-1",
    userId: "user-1",
  });

  assert.equal(questions.length, 1);
  assert.equal(assessmentService.isMultiPartPrompt(questions[0].prompt), false);
  assert.equal(questions[0].prompt, "Jelaskan X.");
});
