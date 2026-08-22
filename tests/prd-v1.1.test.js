const assert = require("node:assert/strict");
const test = require("node:test");

const { buildReproducibilityHashes, sha256, canonical } = require("../server/harness/reproducibility");
const evidencePlugin = require("../server/harness/plugins/evidence");
const { createHarness } = require("../server/harness");
const { MockProvider } = require("../server/ai/mock-provider");
const { parse } = require("../server/ai/response-parser");

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

// ---- FR-15 — Reproducibility hashes ----
test("FR-15: hashes are deterministic for identical input", () => {
  const a = sha256({ answers: ["x"], rubric: { id: "r" } });
  const b = sha256({ answers: ["x"], rubric: { id: "r" } });
  assert.equal(a, b);
});

test("FR-15: hashes differ when answers change", () => {
  const a = sha256({ answers: ["fotosintesis"] });
  const b = sha256({ answers: ["fotosintesis", "respirasi"] });
  assert.notEqual(a, b);
});

test("FR-15: buildReproducibilityHashes returns all four surfaces", () => {
  const h = buildReproducibilityHashes({
    answers: ["jawaban"],
    rubric: { criteria: [{ id: "C1", weight: 1 }] },
    prompt: "rinfo",
    config: { model: { model: "x" } },
  });
  for (const k of ["inputHash", "rubricHash", "promptHash", "configHash"]) {
    assert.ok(typeof h[k] === "string" && h[k].length > 0, k + " must be a non-empty string");
  }
  assert.equal(h.hashingMethod, "sha256");
});

test("FR-15: canonical serialization sorts keys (stable)", () => {
  assert.equal(canonical({ b: 1, a: 2 }), canonical({ a: 2, b: 1 }));
});

// ---- FR-13 Publication gate + FR-16 model metadata ----
function runHarness(rubric, criteria) {
  const harness = createHarness();
  harness.setProvider({
    name: "mock-gate",
    version: "9.9.9",
    async generate() {
      return JSON.stringify({ criteria, rubric });
    },
  }).setParser({ parse });
  return harness.evaluate({
    assessmentId: "a-gate",
    assessment: { id: "a-gate", topic: "t" },
    rubric,
    answers: [STUDENT],
    tenantId: "t",
    userId: "u",
  });
}

test("FR-13: PASS verification publishes automatically", async () => {
  const rubric = { id: "r", criteria: [{ id: "C1", weight: 1 }] };
  const out = await runHarness(rubric, [
    { criterionId: "C1", score: 80, evidence: [{ text: "membuat makanan" }], rationale: "Baik" },
  ]);
  assert.equal(out.verification.status, "PASS");
  assert.equal(out.published, true);
  assert.equal(out.requiresHumanReview, false);
});

test("FR-13: FAIL verification is never published", async () => {
  const rubric = { id: "r", criteria: [{ id: "C1", weight: 0.5 }, { id: "C2", weight: 0.5 }] };
  const out = await runHarness(rubric,
    [{ criterionId: "C1", score: 80, evidence: [{ text: "membuat makanan" }] }]
  );
  assert.equal(out.verification.status, "FAIL");
  assert.equal(out.published, false);
});

test("FR-16: model metadata is recorded in versioning", async () => {
  const rubric = { id: "r", criteria: [{ id: "C1", weight: 1 }] };
  const out = await runHarness(rubric,
    [{ criterionId: "C1", score: 80, evidence: [{ text: "membuat makanan" }] }]
  );
  assert.equal(out.versioning.provider, "mock-gate");
  assert.equal(out.versioning.modelVersion, "9.9.9");
});

// ---- FR-06 — Evidence status enum ----
test("FR-06: grounded evidence carries GROUNDED status", async () => {
  const context = makeContext([STUDENT], []);
  const out = await evidencePlugin.after(context, {
    criteria: [{ criterionId: "C1", score: 80, evidence: [{ text: "membuat makanan" }] }],
  });
  const c = out.criteria[0];
  assert.equal(c.evidence[0].status, "GROUNDED");
  assert.equal(c.evidenceStatus, "GROUNDED");
});

test("FR-06: ungrounded evidence carries UNSUPPORTED status", async () => {
  const context = makeContext([STUDENT], []);
  const out = await evidencePlugin.after(context, {
    criteria: [{ criterionId: "C1", score: 80, evidence: [{ text: "string teoretis tak ada" }] }],
  });
  const c = out.criteria[0];
  assert.equal(c.evidence[0].status, "UNSUPPORTED");
  assert.equal(c.evidenceStatus, "UNSUPPORTED");
});

test("FR-06: empty evidence carries MISSING criterion status", async () => {
  const context = makeContext([STUDENT], []);
  const out = await evidencePlugin.after(context, {
    criteria: [{ criterionId: "C1", score: 80, evidence: [] }],
  });
  const c = out.criteria[0];
  assert.equal(c.noEvidence, true);
  assert.equal(c.evidenceStatus, "MISSING");
  assert.equal(c.evidence.length, 0);
});

// ---- FR-12 — Bounded retry (no infinite loop) ----
test("FR-12: retry is bounded and never loops forever", async () => {
  let calls = 0;
  const config = createHarness({ verification: { maxRetries: 2 } });
  const rubric = { id: "r", criteria: [{ id: "C1", weight: 0.5 }, { id: "C2", weight: 0.5 }] };
  config.setProvider({
    async generate() {
      calls += 1;
      return JSON.stringify({ rubric, criteria: [{ criterionId: "C1", score: 80, evidence: [{ text: "membuat makanan" }] }] });
    },
  }).setParser({ parse });
  const out = await config.evaluate({
    assessment: { id: "a" },
    rubric,
    answers: [STUDENT],
    tenantId: "t",
    userId: "u",
  });
  // maxRetries config=2 => up to 3 attempts; assert bounded and deterministic.
  assert.ok(calls <= 3, "calls=" + calls + " must not exceed maxRetries+1");
  assert.equal(out.verification.status, "FAIL");
});