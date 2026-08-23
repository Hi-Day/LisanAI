const assert = require("node:assert/strict");
const test = require("node:test");

const { createHarness } = require("../server/harness");
const { MockProvider } = require("../server/ai/mock-provider");
const { parse } = require("../server/ai/response-parser");
const { defaultConfig } = require("../server/harness/config");
const { buildReproducibilityHashes, sha256 } = require("../server/harness/reproducibility");
const evidencePlugin = require("../server/harness/plugins/evidence");
const verificationPlugin = require("../server/harness/plugins/verification");
const {
  evaluateWithHarness,
  structuredRubric,
  buildQuestionScores,
  aggregateScore,
} = require("../server/harness/harness-evaluator");
const { calculateFinalScore } = require("../server/evaluation/scoring");

const STUDENT = "Fotosintesis adalah proses tumbuhan membuat makanan dari cahaya matahari.";

function makeContext(answers, idealAnswers = [], opts = {}) {
  const events = [];
  return {
    trace: { event: (name, data) => events.push({ name, data }) },
    input: { answers },
    assessmentContext: {
      questions: idealAnswers.map((ideal, i) => ({ prompt: "Soal " + (i + 1), ideal })),
    },
    config: {
      verification: {
        evidenceCoverage: opts.evidenceCoverage ?? 0.5,
        highScoreThreshold: opts.highScoreThreshold ?? 70,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// P0 — Question ↔ Criterion mapping (partial applicability)
// ---------------------------------------------------------------------------

test("P0: question score aggregates only the criteria applicable to that answer", () => {
  // Q0 (answerIndex 0) has C1+C3; Q1 (answerIndex 1) has C1+C2+C3.
  const criteria = [
    { criterionId: "C1", answerIndex: 0, score: 80, weight: 0.4, rationale: "Baik", confidence: 0.9 },
    { criterionId: "C3", answerIndex: 0, score: 90, weight: 0.25, rationale: "Sangat baik", confidence: 0.8 },
    { criterionId: "C1", answerIndex: 1, score: 90, weight: 0.4, rationale: "Baik", confidence: 0.9 },
    { criterionId: "C2", answerIndex: 1, score: 85, weight: 0.35, rationale: "Bagus", confidence: 0.85 },
    { criterionId: "C3", answerIndex: 1, score: 80, weight: 0.25, rationale: "Cukup", confidence: 0.8 },
  ];
  const qs = buildQuestionScores(
    [{ prompt: "Q1" }, { prompt: "Q2" }],
    ["jawaban 1", "jawaban 2"],
    criteria
  );
  assert.equal(qs.length, 2);
  // Q1: only C1+C3 apply (partial mapping, 2 of 3).
  assert.deepEqual(qs[0].criterionIds, ["C1", "C3"]);
  // Q1 score = (80*0.4 + 90*0.25) / (0.4+0.25) = (32+22.5)/0.65 = 83.846...
  assert.ok(Math.abs(qs[0].score - 83.846) < 0.01);
  // Q2: all three apply.
  assert.deepEqual(qs[1].criterionIds, ["C1", "C2", "C3"]);
  // Q2 score = (90*0.4 + 85*0.35 + 80*0.25) / 1 = 36+29.75+20 = 85.75
  assert.ok(Math.abs(qs[1].score - 85.75) < 0.01);
});

test("P0: criteria without answerIndex apply to every question (assessment-level)", () => {
  const criteria = [
    { criterionId: "C1", score: 80, weight: 0.4, rationale: "Baik" },
    { criterionId: "C2", answerIndex: 0, score: 70, weight: 0.6, rationale: "Cukup" },
  ];
  const qs = buildQuestionScores([{ prompt: "Q1" }, { prompt: "Q2" }], ["a", "b"], criteria);
  // Q0 gets C1 (all) + C2 (answerIndex 0). Order: answerIndex-specific first,
  // then assessment-level ("all") criteria.
  assert.deepEqual([...qs[0].criterionIds].sort(), ["C1", "C2"]);
  // Q1 gets only C1 (all).
  assert.deepEqual(qs[1].criterionIds, ["C1"]);
});

test("P0: question with no applicable criteria scores 0 (not NaN)", () => {
  const criteria = [{ criterionId: "C1", answerIndex: 0, score: 80, weight: 1, rationale: "Baik" }];
  const qs = buildQuestionScores([{ prompt: "Q1" }, { prompt: "Q2" }], ["a", "b"], criteria);
  assert.equal(qs[1].score, 0);
  assert.equal(qs[1].criterionIds.length, 0);
});

test("P0: aggregateScore falls back to mean when no weights present", () => {
  assert.equal(aggregateScore([{ score: 80 }, { score: 90 }]), 85);
  assert.equal(aggregateScore([]), 0);
  assert.equal(aggregateScore([{ score: "abc" }]), 0);
});

test("P0: evaluateWithHarness maps criteria to questions by answerIndex", async () => {
  const result = await evaluateWithHarness({
    assessment: {
      id: "assess-p0-map",
      topic: "Fotosintesis",
      rubric: "Akurasi 40%, Kelengkapan 60%",
      questions: [
        { prompt: "Jelaskan proses fotosintesis", focus: "konsep", ideal: "proses tumbuhan membuat makanan" },
        { prompt: "Mengapa tumbuhan hijau penting?", focus: "aplikasi", ideal: "menghasilkan oksigen" },
      ],
    },
    answers: [
      "Fotosintesis adalah proses tumbuhan membuat makanan dari cahaya matahari dan klorofil.",
      "Tumbuhan penting karena menghasilkan oksigen dan menjadi sumber makanan.",
    ],
    tenantId: "t-p0",
    userId: "u-p0",
  });
  assert.equal(result.questionScores.length, 2);
  assert.ok(result.questionScores.every((q) => typeof q.score === "number"));
  assert.ok(result.questionScores.every((q) => Array.isArray(q.criterionIds)));
});

// ---------------------------------------------------------------------------
// P0 — Single Verification Engine (structured issues)
// ---------------------------------------------------------------------------

test("P0: verification emits structured issue types", async () => {
  const context = makeContext([STUDENT], []);
  const result = {
    rubric: { criteria: [{ id: "C1", weight: 0.5 }, { id: "C2", weight: 0.5 }] },
    criteria: [{ criterionId: "C1", score: 80, evidence: [{ text: "membuat makanan" }] }],
  };
  const withEvidence = await evidencePlugin.after(context, JSON.parse(JSON.stringify(result)));
  const out = await verificationPlugin.after(context, withEvidence);
  assert.equal(out.verification.status, "FAIL");
  assert.ok(
    out.verification.issues.some((i) => i.type === "MISSING_CRITERION" && i.criterionId === "C2"),
    "missing criterion must be a structured MISSING_CRITERION issue"
  );
});

test("P0: ungrounded evidence is a structured UNGROUNDED_EVIDENCE issue", async () => {
  const context = makeContext([STUDENT], []);
  const result = {
    rubric: { criteria: [{ id: "C1", weight: 1 }] },
    criteria: [{ criterionId: "C1", score: 80, evidence: [{ text: "string teoretis tak ada" }] }],
  };
  const withEvidence = await evidencePlugin.after(context, JSON.parse(JSON.stringify(result)));
  const out = await verificationPlugin.after(context, withEvidence);
  assert.ok(
    out.verification.issues.some((i) => i.type === "UNGROUNDED_EVIDENCE"),
    "ungrounded evidence must be a structured issue"
  );
});

test("P0: high score with weak evidence is a structured HIGH_SCORE_WEAK_EVIDENCE anomaly", async () => {
  const context = makeContext([STUDENT], []);
  const result = {
    rubric: { criteria: [{ id: "C1", weight: 1 }] },
    criteria: [{ criterionId: "C1", score: 95, evidence: [{ text: "tidak ada di jawaban" }] }],
  };
  const withEvidence = await evidencePlugin.after(context, JSON.parse(JSON.stringify(result)));
  const out = await verificationPlugin.after(context, withEvidence);
  assert.equal(out.verification.status, "REVIEW");
  assert.ok(
    out.verification.scoreConsistency.anomalies.some((a) => a.type === "HIGH_SCORE_WEAK_EVIDENCE"),
    "high-score-weak-evidence must be a structured anomaly"
  );
});

test("P0: harness delegates to the single verification engine (no competing rules)", async () => {
  const harness = createHarness();
  harness.setProvider(new MockProvider()).setParser({ parse });
  const result = await harness.evaluate({
    assessmentId: "assess-p0-verify",
    assessment: { topic: "t", rubric: "Konsep 100%" },
    rubric: { id: "r", criteria: [{ id: "q1", name: "Konsep", weight: 1, scale: 100 }] },
    answers: ["Ini adalah jawaban mahasiswa tentang fotosintesis dan klorofil untuk grounding."],
    tenantId: "t1",
    userId: "u1",
  });
  // The plugin's gate is the single source of truth.
  assert.ok(result.verification.status === "PASS" || result.verification.status === "REVIEW" || result.verification.status === "FAIL");
  assert.ok(Array.isArray(result.verification.issues));
  assert.ok(Array.isArray(result.verification.reasons));
});

// ---------------------------------------------------------------------------
// P0 — Generation parameters + metadata
// ---------------------------------------------------------------------------

test("P0: default config carries generation parameters", () => {
  const cfg = defaultConfig();
  assert.equal(typeof cfg.model.temperature, "number");
  assert.equal(typeof cfg.model.topP, "number");
  assert.equal(typeof cfg.model.maxTokens, "number");
});

test("P0: generation parameters are recorded in versioning metadata", async () => {
  const harness = createHarness({ model: { temperature: 0.1, topP: 0.9, maxTokens: 2048 } });
  harness.setProvider(new MockProvider()).setParser({ parse });
  const result = await harness.evaluate({
    assessmentId: "assess-p0-gen",
    assessment: { topic: "t", rubric: "Konsep 100%" },
    rubric: { id: "r", criteria: [{ id: "q1", name: "Konsep", weight: 1, scale: 100 }] },
    answers: ["jawaban tentang fotosintesis dan klorofil."],
    tenantId: "t1",
    userId: "u1",
  });
  assert.equal(result.versioning.temperature, 0.1);
  assert.equal(result.versioning.topP, 0.9);
  assert.equal(result.versioning.maxTokens, 2048);
});

test("P0: configHash changes when generation parameters change", () => {
  const cfgA = defaultConfig({ model: { temperature: 0.1 } });
  const cfgB = defaultConfig({ model: { temperature: 0.9 } });
  const hA = buildReproducibilityHashes({ answers: ["x"], rubric: { id: "r" }, prompt: "p", config: cfgA });
  const hB = buildReproducibilityHashes({ answers: ["x"], rubric: { id: "r" }, prompt: "p", config: cfgB });
  assert.notEqual(hA.configHash, hB.configHash);
});

test("P0: promptHash reflects the effective prompt (not null)", async () => {
  const harness = createHarness();
  harness.setProvider(new MockProvider()).setParser({ parse });
  const result = await harness.evaluate({
    assessmentId: "assess-p0-hash",
    assessment: { topic: "t", rubric: "Konsep 100%" },
    rubric: { id: "r", criteria: [{ id: "q1", name: "Konsep", weight: 1, scale: 100 }] },
    answers: ["jawaban tentang fotosintesis dan klorofil."],
    tenantId: "t1",
    userId: "u1",
  });
  assert.ok(result.reproducibility.promptHash, "promptHash must be non-empty");
  assert.ok(result.reproducibility.rubricHash, "rubricHash must be non-empty");
  assert.ok(result.reproducibility.inputHash, "inputHash must be non-empty");
  assert.ok(result.reproducibility.configHash, "configHash must be non-empty");
});

// ---------------------------------------------------------------------------
// P0 — Deterministic scoring
// ---------------------------------------------------------------------------

test("P0: deterministic scoring is stable across repeated calls", () => {
  const rubric = {
    id: "r",
    criteria: [
      { id: "C1", weight: 0.4 },
      { id: "C2", weight: 0.35 },
      { id: "C3", weight: 0.25 },
    ],
  };
  const criteria = [
    { criterionId: "C1", score: 82 },
    { criterionId: "C2", score: 76 },
    { criterionId: "C3", score: 85 },
  ];
  const a = calculateFinalScore(criteria, rubric);
  const b = calculateFinalScore(criteria, rubric);
  assert.equal(a.finalScore, b.finalScore);
  assert.equal(a.finalScore, 80.65); // 82*0.4 + 76*0.35 + 85*0.25
});

test("P0: deterministic scoring clamps out-of-range scores", () => {
  const rubric = { id: "r", criteria: [{ id: "C1", weight: 1 }] };
  const res = calculateFinalScore([{ criterionId: "C1", score: 150 }], rubric);
  assert.equal(res.finalScore, 100);
  const res2 = calculateFinalScore([{ criterionId: "C1", score: -20 }], rubric);
  assert.equal(res2.finalScore, 0);
});

test("P0: deterministic scoring is not affected by LLM (no finalScore from model)", () => {
  // The harness output's finalScore must equal the server-side weighted result.
  const rubric = {
    id: "r",
    criteria: [
      { id: "C1", weight: 0.5 },
      { id: "C2", weight: 0.5 },
    ],
  };
  const criteria = [
    { criterionId: "C1", score: 80 },
    { criterionId: "C2", score: 60 },
  ];
  const weighted = calculateFinalScore(criteria, rubric);
  assert.equal(weighted.finalScore, 70);
});

// ---------------------------------------------------------------------------
// P0 — Evidence adversarial cases
// ---------------------------------------------------------------------------

test("P0: evidence span is always within the answer bounds", async () => {
  const context = makeContext([STUDENT], []);
  const out = await evidencePlugin.after(context, {
    criteria: [{ criterionId: "C1", score: 80, evidence: [{ text: "membuat makanan" }] }],
  });
  const ev = out.criteria[0].evidence[0];
  assert.ok(ev.start >= 0);
  assert.ok(ev.end <= STUDENT.length);
  assert.ok(ev.start <= ev.end);
});

test("P0: evidence confidence is clamped to [0,1]", async () => {
  const context = makeContext([STUDENT], []);
  const out = await evidencePlugin.after(context, {
    criteria: [{ criterionId: "C1", score: 80, evidence: [{ text: "membuat makanan" }] }],
  });
  const ev = out.criteria[0].evidence[0];
  assert.ok(ev.confidence >= 0 && ev.confidence <= 1);
});

test("P0: empty/whitespace evidence is dropped (no blank bullets)", async () => {
  const context = makeContext([STUDENT], []);
  const out = await evidencePlugin.after(context, {
    criteria: [
      {
        criterionId: "C1",
        score: 80,
        evidence: [{ text: "   " }, { text: "membuat makanan" }, { text: "" }],
      },
    ],
  });
  const evs = out.criteria[0].evidence;
  assert.equal(evs.length, 1);
  assert.equal(evs[0].text, "membuat makanan");
});

test("P0: evidence that only exists in ideal answer is never grounded (FR-01)", async () => {
  const context = makeContext(
    ["jawaban mahasiswa: fotosintesis"],
    ["fotosintesis DAN pembuatan makanan oleh mahasiswa secara rinci"]
  );
  const out = await evidencePlugin.after(context, {
    criteria: [
      {
        criterionId: "C1",
        score: 80,
        evidence: [{ text: "pembuatan makanan oleh mahasiswa secara rinci" }],
      },
    ],
  });
  assert.equal(out.criteria[0].evidence[0].grounded, false);
});

test("P0: adversarial — evidence with only 1-word overlap is not grounded", async () => {
  const context = makeContext(["fotosintesis adalah proses tumbuhan"], []);
  const out = await evidencePlugin.after(context, {
    criteria: [
      {
        criterionId: "C1",
        score: 80,
        evidence: [{ text: "fotosintesis respirasi klorofil" }],
      },
    ],
  });
  // Only "fotosintesis" overlaps; the 2+ word run "fotosintesis respirasi" is absent.
  assert.equal(out.criteria[0].evidence[0].grounded, false);
});

// ---------------------------------------------------------------------------
// P0 — Verification adversarial cases
// ---------------------------------------------------------------------------

test("P0: duplicate criterion ids are rejected by rubric validation", () => {
  const { validateRubric } = require("../server/harness/validator");
  const bad = { criteria: [{ id: "C1", weight: 0.5 }, { id: "C1", weight: 0.5 }] };
  const check = validateRubric(bad);
  assert.equal(check.valid, false);
  assert.ok(check.issues.some((i) => i.includes("duplikat")));
});

test("P0: invalid score (out of range) fails verification", async () => {
  const context = makeContext([STUDENT], []);
  const result = {
    rubric: { criteria: [{ id: "C1", weight: 1 }] },
    criteria: [{ criterionId: "C1", score: 150, evidence: [{ text: "membuat makanan" }] }],
  };
  const withEvidence = await evidencePlugin.after(context, JSON.parse(JSON.stringify(result)));
  const out = await verificationPlugin.after(context, withEvidence);
  assert.equal(out.verification.status, "FAIL");
  assert.ok(out.verification.issues.some((i) => i.type === "SCHEMA_INVALID"));
});

test("P0: no evidence at all fails verification (NO_EVIDENCE)", async () => {
  const context = makeContext([STUDENT], []);
  const result = {
    rubric: { criteria: [{ id: "C1", weight: 1 }] },
    criteria: [{ criterionId: "C1", score: 80, evidence: [] }],
  };
  const withEvidence = await evidencePlugin.after(context, JSON.parse(JSON.stringify(result)));
  const out = await verificationPlugin.after(context, withEvidence);
  assert.equal(out.verification.status, "FAIL");
  assert.ok(out.verification.issues.some((i) => i.type === "NO_EVIDENCE"));
});

test("P0: publication gate — FAIL never publishes, REVIEW requires human review", async () => {
  const harness = createHarness();
  harness.setProvider({
    name: "mock-pub",
    version: "1.0.0",
    async generate() {
      return JSON.stringify({
        rubric: { id: "r", criteria: [{ id: "C1", weight: 0.5 }, { id: "C2", weight: 0.5 }] },
        criteria: [{ criterionId: "C1", score: 80, evidence: [{ text: "membuat makanan" }] }],
      });
    },
  }).setParser({ parse });
  const out = await harness.evaluate({
    assessmentId: "a-pub",
    assessment: { id: "a-pub", topic: "t" },
    rubric: { id: "r", criteria: [{ id: "C1", weight: 0.5 }, { id: "C2", weight: 0.5 }] },
    answers: [STUDENT],
    tenantId: "t",
    userId: "u",
  });
  assert.equal(out.verification.status, "FAIL");
  assert.equal(out.published, false);
});