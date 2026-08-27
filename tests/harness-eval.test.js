const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

process.env.TURSO_DATABASE_URL = `file:${path.join(os.tmpdir(), `lisan-harness-eval-${Date.now()}.db`)}`;
process.env.ENABLE_DEMO_SIMULATION = "false";
process.env.HARNESS_PROVIDER = "mock";

const { initDatabase, getDb } = require("../server/database");
const { evaluateWithHarness, structuredRubric, splitFeedback, buildQuestionScores, calculateAlignedFinalScore } = require("../server/harness/harness-evaluator");
const { persistEvaluationTrace } = require("../server/evaluation/trace-persister");
const { createHarness } = require("../server/harness");
const { MockProvider } = require("../server/ai/mock-provider");
const { parse } = require("../server/ai/response-parser");

const ASSESSMENT = {
  id: "assess-harness-1",
  topic: "Fotosintesis",
  difficulty: "Menengah",
  rubric: "Akurasi 40%, Kelengkapan 60%",
  questions: [
    { prompt: "Jelaskan proses fotosintesis", focus: "konsep", ideal: "proses tumbuhan membuat makanan" },
    { prompt: "Mengapa tumbuhan hijau penting?", focus: "aplikasi", ideal: "menghasilkan oksigen" },
  ],
};

test.before(async () => {
  const dbPath = process.env.TURSO_DATABASE_URL.replace(/^file:/, "");
  fs.rmSync(dbPath, { force: true });
  await initDatabase();
  // Seed a tenant + assessment so evaluation_runs FK to assessments() resolves.
  await getDb().run(
    `INSERT INTO tenants (id, name, plan, created_at) VALUES (?, ?, ?, ?)`,
    "t-harness",
    "Harness Test",
    "starter",
    new Date().toISOString()
  );
  await getDb().run(
    `INSERT INTO assessments (id, tenant_id, status, topic, difficulty, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ASSESSMENT.id,
    "t-harness",
    "published",
    ASSESSMENT.topic,
    ASSESSMENT.difficulty,
    JSON.stringify(ASSESSMENT),
    new Date().toISOString()
  );
});

test("structuredRubric parses free-text assessment rubric into weighted criteria", () => {
  const r = structuredRubric({ answers: ["a", "b"] }, ASSESSMENT, 2);
  assert.ok(Array.isArray(r.criteria));
  assert.ok(Math.abs(r.criteria.reduce((s, c) => s + c.weight, 0) - 1) < 1e-6);
  assert.equal(r.criteria.length, 2); // 40% + 60%
});

test("splitFeedback puts critique sentences into gaps, not strengths", () => {
  const rationale =
    "Jawaban tidak menyebutkan teori Piaget atau Erikson, tidak ada analisis tahapan perkembangan kognitif, dan tidak relevan dengan pertanyaan. Jawaban mencakup konsep dasar dengan benar.";
  const { strengths, gaps } = splitFeedback(rationale, 100);
  assert.ok(gaps.length > 0, "critique must go to gaps");
  assert.ok(
    gaps.some((g) => g.toLowerCase().includes("tidak menyebut")),
    "unsupported-mention critique should be in gaps"
  );
  assert.ok(
    strengths.some((s) => s.toLowerCase().includes("konsep dasar")),
    "positive sentence should stay in strengths"
  );

  // Low score forces every sentence into gaps even without keywords.
  const low = splitFeedback("Tidak ada kritik khusus tersurat.", 50);
  assert.ok(low.gaps.length > 0);
  assert.equal(low.strengths.length, 0);

  // Low score must NOT wipe out explicit strengths (regression: score 40,
  // model praised correctness -> Kekuatan was empty before this fix).
  const lowWithStrength = splitFeedback(
    "Student correctly identifies the core idea of modularity and gives a relevant example. However, the answer is too brief and lacks depth.",
    40
  );
  assert.ok(
    lowWithStrength.strengths.some((s) => s.toLowerCase().includes("correctly")),
    "explicit strength must survive a low score"
  );
  assert.ok(
    lowWithStrength.gaps.some((g) => g.toLowerCase().includes("lack")),
    "critique must still be in gaps"
  );
});

test("evaluateWithHarness returns frontend contract + harness provenance", async () => {
  const result = await evaluateWithHarness({
    assessment: ASSESSMENT,
    answers: [
      "Fotosintesis adalah proses tumbuhan membuat makanan dari cahaya matahari dan klorofil.",
      "Tumbuhan penting karena menghasilkan oksigen dan menjadi sumber makanan.",
    ],
    studentName: "Siswa A",
    tenantId: "t-harness",
    userId: "u-harness",
  });

  assert.equal(typeof result.finalScore, "number");
  assert.ok(result.finalScore >= 0 && result.finalScore <= 100);
  assert.ok(Array.isArray(result.questionScores) && result.questionScores.length === 2);
  assert.ok(result.questionScores.every((q) => typeof q.score === "number"));
  assert.ok(result.evaluationRunId);
  assert.ok(result.evaluationId);
  // LLM never computed finalScore — server-side weighted result present.
  assert.ok(result.versioning && result.versioning.harnessVersion);
  assert.ok(result.verification);
});

test("evaluateWithHarness blocks a FAIL verification gate (never surfaces final score)", async () => {
  // Empty answer -> mock provider emits evidence: [] -> NO_EVIDENCE -> FAIL.
  const FAIL_ASSESSMENT = {
    id: "assess-harness-fail",
    topic: "Rubrik dua kriteria",
    difficulty: "Menengah",
    rubric: { criteria: [{ id: "C1", weight: 0.5 }, { id: "C2", weight: 0.5 }] },
    questions: [{ prompt: "Soal", focus: "konsep" }],
  };
  await assert.rejects(
    () =>
      evaluateWithHarness({
        assessment: FAIL_ASSESSMENT,
        answers: [""],
        tenantId: "t-harness",
        userId: "u-harness",
        harnessConfig: {
          pipeline: { evidence: false },
          verification: { evidenceCoverage: 0.5 },
        },
      }),
    (err) => {
      assert.equal(err.status, 422);
      assert.ok(err.message.includes("verifikasi gagal"));
      return true;
    }
  );
});

test("evaluateWithHarness downgrades FAIL to REVIEW when ONLY skipped (empty) questions are the cause", async () => {
  // A student answers some questions but skips others -> the skipped ones have
  // no evidence (NO_EVIDENCE). This is a legitimate "scored 0, needs human
  // review" outcome, NOT a hard failure. Must return a REVIEW result instead
  // of throwing.
  const PARTIAL_ASSESSMENT = {
    id: "assess-harness-partial",
    topic: "Rubrik dua kriteria",
    difficulty: "Menengah",
    rubric: "Akurasi 40%, Kelengkapan 60%",
    questions: [
      { prompt: "Soal 1", focus: "konsep" },
      { prompt: "Soal 2", focus: "aplikasi" },
    ],
  };
  const result = await evaluateWithHarness({
    assessment: PARTIAL_ASSESSMENT,
    // Soal 1 dijawab, Soal 2 dikosongkan.
    answers: ["Fotosintesis adalah proses tumbuhan membuat makanan dari cahaya.", ""],
    tenantId: "t-harness",
    userId: "u-harness",
  });
  assert.equal(result.verification.status, "REVIEW");
  assert.equal(result.requiresHumanReview, true);
  assert.equal(result.published, false);
  assert.ok(Array.isArray(result.questionScores) && result.questionScores.length === 2);
});

test("evaluateWithHarness flags requiresHumanReview on a REVIEW gate", async () => {
  // One criterion, no grounded evidence -> WEAK_COVERAGE -> REVIEW, not FAIL.
  const REVIEW_ASSESSMENT = {
    id: "assess-harness-review",
    topic: "Rubrik satu kriteria",
    difficulty: "Menengah",
    rubric: { criteria: [{ id: "Q1", weight: 1 }] },
    questions: [{ prompt: "Soal", focus: "konsep" }],
  };
  const result = await evaluateWithHarness({
    assessment: REVIEW_ASSESSMENT,
    answers: ["Jawaban singkat namun tidak memuat evidence."],
    tenantId: "t-harness",
    userId: "u-harness",
    harnessConfig: {
      pipeline: { evidence: false },
      verification: { evidenceCoverage: 1 },
    },
  });
  assert.equal(result.verification.status, "REVIEW");
  assert.equal(result.requiresHumanReview, true);
  assert.equal(result.published, false);
});

test("questionScores carries explicit model strengths/gaps when present", async () => {
  const harness = createHarness({ pipeline: { evidence: false, reliability: false } });
  harness.setProvider({
    name: "explicit-str",
    version: "1.0.0",
    async generate() {
      return JSON.stringify({
        criteria: [
          {
            criterionId: "Q1", score: 80, evidence: [{ text: "klorofil" }],
            strengths: ["Menyebut klorofil dengan tepat", "Contoh relevan"],
            gaps: ["Cara kerja panel surya belum dijelaskan"],
          },
        ],
      });
    },
  }).setParser({ parse });

  const result = await harness.evaluate({
    assessment: { id: "a", topic: "t" },
    rubric: { id: "r", criteria: [{ id: "Q1", weight: 1 }] },
    answers: ["Menjawab tentang klorofil."],
    tenantId: "t-harness",
    userId: "u-harness",
  });

  const qs = buildQuestionScores([{ prompt: "Soal" }], ["Menjawab tentang klorofil."], result.criteria);
  assert.ok(qs[0].strengths.some((s) => s.includes("klorofil")));
  assert.ok(qs[0].gaps.length > 0);
  assert.equal(qs[0].strengths.length, 2);
});

test("questionScores is bounded to the number of student answers (even if rubric has more criteria)", async () => {
  const ONE_ASSESSMENT = {
    id: ASSESSMENT.id,
    topic: "Psikologi",
    difficulty: "Menengah",
    rubric: "Akurasi 40%, Kelengkapan 60%",
    questions: [{ prompt: "Jelaskan Piaget dan Erikson", focus: "konsep", ideal: "tahapan" }],
  };
  const result = await evaluateWithHarness({
    assessment: ONE_ASSESSMENT,
    answers: ["Jawaban tunggal singkat."],
    tenantId: "t-harness",
    userId: "u-harness",
  });
  // 1 answer, but rubric parsed 2 criteria -> per-question contract must be 1.
  assert.equal(result.questionScores.length, 1);
  assert.equal(result.questionScores[0].question, "Jelaskan Piaget dan Erikson");
});

test("trace persister reconstructs a run from the DB", async () => {
  const harness = createHarness();
  harness.setProvider(new MockProvider()).setParser({ parse });
  harness.setTracePersister(persistEvaluationTrace);

  const result = await harness.evaluate({
    assessmentId: ASSESSMENT.id,
    assessment: ASSESSMENT,
    rubric: structuredRubric({ answers: ["x"] }, ASSESSMENT, 2),
    answers: ["jawaban A"],
    tenantId: "t-trace",
    userId: "u-trace",
  });

  // Reconstruct from DB via the harness trace API.
  const saved = await harness.trace(result.evaluationRunId);
  assert.equal(saved.available, true);
  assert.equal(saved.runId, result.evaluationRunId);
  assert.ok(Array.isArray(saved.events) && saved.events.length > 0);
  assert.ok(saved.result);
  assert.equal(saved.result.finalScore, result.finalScore);

  // Raw table checks.
  const db = getDb();
  const runRow = await db.get("SELECT * FROM evaluation_runs WHERE run_id = ?", result.evaluationRunId);
  assert.ok(runRow);
  assert.equal(runRow.final_score, result.finalScore);
  const critRows = await db.all("SELECT * FROM evaluation_criteria WHERE run_id = ?", result.evaluationRunId);
  assert.equal(critRows.length, result.criteria.length);
});

test("trace persists even when the assessmentId has no assessment row (FK-safe)", async () => {
  const harness = createHarness();
  harness.setProvider(new MockProvider()).setParser({ parse });
  harness.setTracePersister(persistEvaluationTrace);

  // assessmentId does NOT exist in assessments table -> FK would reject.
  const result = await harness.evaluate({
    assessmentId: "virtual-no-db-row",
    assessment: { id: "virtual-no-db-row", topic: "t", rubric: "X 100%" },
    rubric: { id: "r", criteria: [{ id: "q1", name: "Soal 1", weight: 1, scale: 100 }] },
    answers: ["jawaban A"],
    tenantId: "t-fksafe",
    userId: "u-fksafe",
  });

  const db = getDb();
  const runRow = await db.get("SELECT * FROM evaluation_runs WHERE run_id = ?", result.evaluationRunId);
  assert.ok(runRow, "run harus tersimpan walaupun assessmentId tidak ada di DB");
});

test("buildQuestionScores only applies the rubric criteria a soal actually measures (alignment)", () => {
  const rubric = {
    id: "r",
    criteria: [
      { id: "ketepatan_konsep", name: "Ketepatan konsep", weight: 0.4 },
      { id: "sebab_akibat", name: "Hubungan sebab-akibat", weight: 0.25 },
      { id: "contoh_relevan", name: "Contoh relevan", weight: 0.2 },
      { id: "kejelasan", name: "Kejelasan komunikasi", weight: 0.15 },
    ],
  };
  const criteria = [
    { criterionId: "ketepatan_konsep", score: 90, evidence: [{ text: "tikus" }], rationale: "Benar menyebut tiga komponen." },
    { criterionId: "sebab_akibat", score: 10, evidence: [], rationale: "Tidak menjelaskan hubungan sebab-akibat." },
    { criterionId: "contoh_relevan", score: 80, evidence: [{ text: "padi" }], rationale: "Contoh relevan." },
    { criterionId: "kejelasan", score: 60, evidence: [{ text: "tikus" }], rationale: "Cukup jelas." },
  ];

  // Soal "sebutkan" hanya memetakan kriteria yang terukur dari penyebutan.
  const questions = [
    {
      prompt: "Sebutkan tiga contoh komponen biotik dalam ekosistem sawah.",
      criteria: [
        { id: "ketepatan_konsep", name: "Ketepatan konsep" },
        { id: "contoh_relevan", name: "Contoh relevan" },
      ],
    },
  ];
  const qs = buildQuestionScores(questions, ["tikus ular padi"], criteria, rubric);

  // Skor soal = agregat berbobot hanya atas 2 kriteria yg dipetakan (90*0.4/0.6 + 80*0.2/0.6 ≈ 86.7).
  assert.ok(Math.abs(qs[0].score - 86.67) < 0.1);
  assert.deepEqual(new Set(qs[0].criterionIds), new Set(["ketepatan_konsep", "contoh_relevan"]));
  assert.ok(
    qs[0].gaps.every((g) => !g.toLowerCase().includes("sebab-akibat")),
    "gap dari kriteria yang tidak ditanyakan soal tidak boleh muncul"
  );

  // Tanpa mapping (soal manual/lama) → semua kriteria berlaku (perilaku legacy).
  const legacy = buildQuestionScores(
    [{ prompt: "Sebutkan komponen biotik" }],
    ["tikus"],
    criteria,
    rubric
  );
  assert.equal(legacy[0].criterionIds.length, 4);
});

test("calculateAlignedFinalScore excludes rubric criteria that no soal asks and renormalizes", () => {
  const rubric = {
    id: "r",
    criteria: [
      { id: "ketepatan_konsep", name: "Ketepatan konsep", weight: 0.4 },
      { id: "sebab_akibat", name: "Hubungan sebab-akibat", weight: 0.25 },
      { id: "kejelasan", name: "Kejelasan komunikasi", weight: 0.35 },
    ],
  };
  const criteriaEvals = [
    { criterionId: "ketepatan_konsep", score: 90 },
    { criterionId: "sebab_akibat", score: 10 }, // dihukum, padahal tidak ada soal menanyakan ini
    { criterionId: "kejelasan", score: 80 },
  ];
  const questions = [
    {
      prompt: "Sebutkan tiga contoh komponen biotik dalam ekosistem sawah.",
      criteria: [{ id: "ketepatan_konsep", name: "Ketepatan konsep" }],
    },
    {
      prompt: "Jelaskan penyebab perubahan populasi tikus.",
      criteria: [
        { id: "ketepatan_konsep", name: "Ketepatan konsep" },
        { id: "kejelasan", name: "Kejelasan komunikasi" },
      ],
    },
  ];

  const aligned = calculateAlignedFinalScore(criteriaEvals, rubric, questions);
  assert.ok(aligned, "harus ada hasil teraligned");
  assert.ok(aligned.excludedCriterionIds.includes("sebab_akibat"), "kriteria yang tidak diukur soal harus dikeluarkan");
  // 90*0.4/0.75 + 80*0.35/0.75 = 48 + 37.33 = 85.33
  assert.equal(aligned.finalScore, Math.round(48 + 37.33));
});

test("calculateAlignedFinalScore falls back to null when no soal declares mapping", () => {
  const rubric = { id: "r", criteria: [{ id: "c1", name: "C1", weight: 1 }] };
  const aligned = calculateAlignedFinalScore(
    [{ criterionId: "c1", score: 75 }],
    rubric,
    [{ prompt: "Soal tanpa mapping" }]
  );
  assert.equal(aligned, null, "tanpa mapping harus memakai agregat mentah (legacy)");
});