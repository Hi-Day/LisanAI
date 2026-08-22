const assert = require("node:assert/strict");
const test = require("node:test");

const evidencePlugin = require("../server/harness/plugins/evidence");
const verificationPlugin = require("../server/harness/plugins/verification");
const { parseRubricText } = require("../server/harness/plugins/rubric");
const { createHarness } = require("../server/harness");
const { MockProvider } = require("../server/ai/mock-provider");
const { parse } = require("../server/ai/response-parser");

// A trace stub that records events (no DB dependency).
function makeContext(answers, idealAnswers, opts = {}) {
  const events = [];
  return {
    trace: { event: (name, data) => events.push({ name, data }) },
    input: { answers },
    assessmentContext: {
      questions: idealAnswers.map((ideal, i) => ({
        prompt: `Soal ${i + 1}`,
        ideal,
      })),
    },
    config: {
      verification: {
        evidenceCoverage: opts.evidenceCoverage ?? 0.5,
        highScoreThreshold: opts.highScoreThreshold ?? 70,
      },
    },
  };
}

const STUDENT_ANSWER = "Fotosintesis adalah proses tumbuhan membuat makanan dari cahaya matahari.";
const STUDENT = STUDENT_ANSWER;

// Run a result through the evidence `after` hook first (so evidence carries
// the v2 `grounded`/`groundingMethod` fields), then through verification.
async function gatherAndVerify(context, result) {
  const withEvidence = await evidencePlugin.after(context, JSON.parse(JSON.stringify(result)));
  return verificationPlugin.after(context, withEvidence);
}

// ---------------------------------------------------------------------------
// PR-01 — Evidence Contamination Fix
// ---------------------------------------------------------------------------

test("TC-01: ideal-answer text is grounded=false even if it differs from student answer", async () => {
  const context = makeContext(
    [STUDENT_ANSWER],
    ["ideal jawaban yang TIDAK ada di jawaban mahasiswa"]
  );
  const result = {
    criteria: [
      {
        criterionId: "C1",
        score: 80,
        evidence: [{ text: "ideal jawaban yang TIDAK ada di jawaban mahasiswa" }],
      },
    ],
  };
  const out = await evidencePlugin.after(context, result);
  const ev = out.criteria[0].evidence[0];
  assert.equal(ev.grounded, false, "ideal-answer evidence must not be grounded");
  assert.equal(ev.groundingMethod, null);
});

test("TC-01b: grounding corpus is student answer ONLY (ideal not in corpus)", async () => {
  // Student text is identical to part of the ideal answer; only a phrase that
  // appears in BOTH should ground. A phrase present ONLY in ideal must fail.
  const context = makeContext(
    ["jawaban mahasiswa: fotosintesis"],
    ["fotosintesis DAN pembuatan makanan oleh mahasiswa secara rinci"]
  );
  const result = {
    criteria: [
      {
        criterionId: "C1",
        score: 80,
        evidence: [{ text: "pembuatan makanan oleh mahasiswa secara rinci" }],
      },
    ],
  };
  const out = await evidencePlugin.after(context, result);
  // Only "fotosintesis" in the student answer; the rest is from ideal → ungrounded.
  assert.equal(out.criteria[0].evidence[0].grounded, false);
});

// ---------------------------------------------------------------------------
// PR-02 FR-02 — Evidence Object v2 provenance
// ---------------------------------------------------------------------------

test("TC-02: exact evidence returns grounded=true with provenance offsets & method", async () => {
  const phrase = "membuat energi dari cahaya matahari";
  const context = makeContext([`The answer: ${phrase}.`], []);
  const result = {
    criteria: [
      {
        criterionId: "C1",
        score: 85,
        evidence: [{ text: phrase }],
      },
    ],
  };
  const out = await evidencePlugin.after(context, result);
  const ev = out.criteria[0].evidence[0];
  assert.equal(ev.grounded, true);
  assert.equal(ev.groundingMethod, "lexical");
  assert.equal(ev.criterionId, "C1");
  assert.equal(ev.answerIndex, 0);
  assert.ok(typeof ev.start === "number");
  assert.ok(typeof ev.end === "number");
  assert.ok(ev.confidence > 0 && ev.confidence <= 1);
  // The extracted slice must match the original evidence text.
  assert.equal(
    `The answer: ${phrase}.`.toLowerCase().slice(ev.start, ev.end),
    phrase.toLowerCase()
  );
});

test("FR-2: multiple answers carry correct answerIndex", async () => {
  const context = makeContext(["jawaban pertama", "jawaban kedua untuk duplikat"], []);
  const result = {
    criteria: [
      {
        criterionId: "C1",
        score: 80,
        evidence: [{ text: "jawaban kedua untuk duplikat" }],
      },
    ],
  };
  const out = await evidencePlugin.after(context, result);
  const ev = out.criteria[0].evidence[0];
  assert.equal(ev.grounded, true);
  assert.equal(ev.answerIndex, 1);
});

// ---------------------------------------------------------------------------
// PR-03 FR-03 — Criterion-Evidence Mapping / no_evidence marker
// ---------------------------------------------------------------------------

test("FR-03: empty evidence yields noEvidence=true marker", async () => {
  const context = makeContext([STUDENT], []);
  const result = {
    criteria: [
      {
        criterionId: "C1",
        score: 90,
        evidence: [],
      },
    ],
  };
  const out = await evidencePlugin.after(context, result);
  assert.equal(out.criteria[0].noEvidence, true);
  assert.equal(out.criteria[0].evidence.length, 0);
});

test("FR-03: criteria with evidence do NOT get noEvidence marker", async () => {
  const context = makeContext([STUDENT], []);
  const result = {
    criteria: [
      {
        criterionId: "C1",
        score: 90,
        evidence: [{ text: "membuat energi" }],
      },
    ],
  };
  const out = await evidencePlugin.after(context, result);
  assert.equal(out.criteria[0].noEvidence, undefined);
});

// ---------------------------------------------------------------------------
// PR-04 / FR-08 — Verification Gate PASS / REVIEW / FAIL
// ---------------------------------------------------------------------------

test("TC-05: high score with weak evidence coverage returns REVIEW", async () => {
  // Student answer contains "membuat makanan" (grounded for C1) but C2's
  // evidence text is absent → weak coverage on a high score → REVIEW.
  const context = makeContext([STUDENT], []);
  const result = {
    rubric: {
      criteria: [
        { id: "C1", weight: 0.5 },
        { id: "C2", weight: 0.5 },
      ],
    },
    criteria: [
      {
        criterionId: "C1",
        score: 95,
        evidence: [{ text: "membuat makanan" }], // grounded in STUDENT
      },
      {
        criterionId: "C2",
        score: 95,
        evidence: [{ text: "konsep ini tidak muncul" }], // not grounded
      },
    ],
  };
  const out = await gatherAndVerify(context, result);
  assert.equal(out.verification.status, "REVIEW");
  assert.ok(out.verification.reasons.length > 0);
});

test("FR-08: review due to low evidence coverage", async () => {
  const context = makeContext([STUDENT], []);
  const result = {
    rubric: {
      criteria: [
        { id: "C1", weight: 0.5 },
        { id: "C2", weight: 0.5 },
      ],
    },
    criteria: [
      { criterionId: "C1", score: 70, evidence: [{ text: "tidak ada di jawaban" }] },
      { criterionId: "C2", score: 70, evidence: [{ text: "juga tidak ada" }] },
    ],
  };
  const out = await gatherAndVerify(context, result);
  assert.equal(out.verification.status, "REVIEW");
});

test("FR-08: healthy evaluation with all grounded evidence -> PASS", async () => {
  const context = makeContext([STUDENT], []);
  const result = {
    rubric: {
      criteria: [{ id: "C1", weight: 1 }],
    },
    criteria: [{ criterionId: "C1", score: 80, evidence: [{ text: "membuat makanan" }] }],
  };
  const out = await gatherAndVerify(context, result);
  assert.equal(out.verification.status, "PASS");
});

test("TC-04/FR-08: missing criterion -> FAIL", async () => {
  const context = makeContext([STUDENT], []);
  const result = {
    rubric: {
      criteria: [
        { id: "C1", weight: 0.5 },
        { id: "C2", weight: 0.5 },
      ],
    },
    criteria: [{ criterionId: "C1", score: 80, evidence: [{ text: "membuat makanan" }] }],
  };
  const out = await gatherAndVerify(context, result);
  assert.equal(out.verification.status, "FAIL");
});

test("TC-06: invalid rubric weight is rejected (scoring engine)", () => {
  const { calculateFinalScore } = require("../server/evaluation/scoring");
  const bad = {
    criteria: [
      { id: "a", weight: 0.8 },
      { id: "b", weight: 0.8 },
    ],
  };
  assert.throws(() => calculateFinalScore([{ criterionId: "a", score: 80 }], bad));
});

// ---------------------------------------------------------------------------
// End-to-end: stringing the new evidence + verification into the full harness
// ---------------------------------------------------------------------------

test("harness emits verification.status and v2 evidence schema", async () => {
  const harness = createHarness();
  harness.setProvider(new MockProvider()).setParser({ parse });
  const result = await harness.evaluate({
    assessmentId: "assess-ev",
    assessment: { topic: "t", rubric: "Konsep 100%" },
    rubric: { id: "r", criteria: [{ id: "q1", name: "Konsep", weight: 1, scale: 100 }] },
    answers: ["Ini adalah jawaban mahasiswa tentang fotosintesis dan klorofil untuk grounding."],
    tenantId: "t1",
    userId: "u1",
  });
  assert.equal(result.verification.status, "PASS");
  assert.ok(result.verification.scoreConsistency);
  assert.equal(result.verification.scoreConsistency.coverage, 1);
  // Evidence follows the v2 schema.
  const ev = result.criteria[0].evidence[0];
  assert.ok("groundingMethod" in ev);
  assert.ok("answerIndex" in ev);
  assert.equal(ev.grounded, true);
});

// ---------------------------------------------------------------------------
// Regression: evidence in non-{text} shapes + tolerant grounding
// ---------------------------------------------------------------------------

test("evidence normalizes array-of-strings into v2 objects", async () => {
  const phrase = "fotosintesis dan klorofil";
  const context = makeContext([`Tumbuhan melakukan ${phrase}.`], []);
  const result = {
    criteria: [{ criterionId: "C1", score: 80, evidence: [phrase, "komponen lain"] }],
  };
  const out = await evidencePlugin.after(context, result);
  const ev0 = out.criteria[0].evidence[0];
  assert.equal(ev0.text, phrase);
  assert.equal(ev0.grounded, true);
  // Unmatched second string is dropped from the list (still counted).
  assert.equal(out.criteria[0].evidence.length, 2);
});

test("evidence accepts {quote}/{content} shapes from the model", async () => {
  const phrase = "membuat makanan dari cahaya";
  const context = makeContext([`Tanaman ${phrase} matahari.`], []);
  const result = {
    criteria: [{ criterionId: "C1", score: 80, evidence: [{ quote: phrase }] }],
  };
  const out = await evidencePlugin.after(context, result);
  assert.equal(out.criteria[0].evidence[0].text, phrase);
  assert.equal(out.criteria[0].evidence[0].grounded, true);
});

test("tolerant grounding accepts a contiguous word-run of the evidence", async () => {
  // Full evidence is not a verbatim substring, but a 2+ word run is present.
  const context = makeContext(["jawaban membuat makanan dari fosil dan cahaya."], []);
  const result = {
    criteria: [{ criterionId: "C1", score: 80, evidence: [{ text: "membuat makanan dari energi" }] }],
  };
  const out = await evidencePlugin.after(context, result);
  const ev = out.criteria[0].evidence[0];
  assert.equal(ev.grounded, true, "contiguous run 'membuat makanan dari' grounds");
});

// ---------------------------------------------------------------------------
// Rubric parsing — avoid collapsing multi-criterion rubrics into "overall"
// ---------------------------------------------------------------------------

test("parseRubricText keeps multi-line/percent rubrics as multiple criteria", () => {
  const r = parseRubricText("Akurasi 40%\nKelengkapan 60%");
  assert.equal(r.length, 2);
  assert.equal(r[0].id, "akurasi");
  assert.equal(r[1].id, "kelengkapan");
  assert.ok(Math.abs(r.reduce((s, c) => s + c.weight, 0) - 1) < 1e-6);
});

test("parseRubricText shares weight equally when no percents given (no 'overall')", () => {
  const r = parseRubricText("Konsep, Aplikasi, Komunikasi");
  assert.equal(r.length, 3);
  assert.equal(r[0].id, "konsep");
  assert.ok(Math.abs(r.reduce((s, c) => s + c.weight, 0) - 1) < 1e-6);
  // Not collapsed to a single 'overall'.
  assert.ok(r.every((c) => c.id !== "overall"));
});

test("parseRubricText supports leading-percent and 'name: %' formats", () => {
  assert.equal(parseRubricText("40% Akurasi, 60% Kelengkapan").length, 2);
  assert.equal(parseRubricText("Akurasi: 50 PEntah; Kelengkapan: 50").length, 2);
});