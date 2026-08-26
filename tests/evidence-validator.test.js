const test = require("node:test");
const assert = require("node:assert/strict");

const {
  locateEvidence,
  validateEvidence,
  validateEvidenceList,
} = require("../server/harness/evidence-validator");

const ANSWER = "Diafragma berkontraksi sehingga volume paru meningkat.";

// ---------------------------------------------------------------------------
// Exact match
// ---------------------------------------------------------------------------

test("evidence: exact match sub match is valid with provenance", () => {
  const res = validateEvidence({ evidenceText: "Diafragma berkontraksi", answer: ANSWER });
  assert.equal(res.valid, true);
  assert.equal(res.span.start, 0);
  assert.equal(res.span.end, 22);
  assert.equal(res.span.matched, "Diafragma berkontraksi");
});

test("evidence: exact full-answer match is valid", () => {
  const res = validateEvidence({ evidenceText: ANSWER, answer: ANSWER });
  assert.equal(res.valid, true);
  assert.equal(res.span.start, 0);
  assert.equal(res.span.end, ANSWER.length);
});

// ---------------------------------------------------------------------------
// Substring behavior
// ---------------------------------------------------------------------------

test("evidence: valid substring in the middle of the answer", () => {
  const res = validateEvidence({ evidenceText: "volume paru meningkat", answer: ANSWER });
  assert.equal(res.valid, true);
  assert.equal(res.span.start, ANSWER.indexOf("volume paru meningkat"));
});

test("evidence: paraphrase not present in answer is INVALID", () => {
  const res = validateEvidence({
    evidenceText: "Volume udara meningkat karena otot menarik tulang rusuk",
    answer: ANSWER,
  });
  assert.equal(res.valid, false);
  assert.equal(res.reason, "NOT_FOUND");
});

// ---------------------------------------------------------------------------
// Case normalization
// ---------------------------------------------------------------------------

test("evidence: case-insensitive validation, original-case span preserved", () => {
  const res = validateEvidence({ evidenceText: "diafragma BERKONTRAKSI", answer: ANSWER });
  assert.equal(res.valid, true, "case-normalized match should be valid");
  assert.equal(res.span.matched, "Diafragma berkontraksi", "span keeps original transcript case");
});

// ---------------------------------------------------------------------------
// Empty / malformed evidence
// ---------------------------------------------------------------------------

test("evidence: empty evidence is invalid", () => {
  assert.equal(validateEvidence({ evidenceText: "", answer: ANSWER }).valid, false);
  assert.equal(validateEvidence({ evidenceText: "   ", answer: ANSWER }).valid, false);
  assert.equal(validateEvidence({ evidenceText: null, answer: ANSWER }).valid, false);
  assert.equal(validateEvidence({ evidenceText: undefined, answer: ANSWER }).valid, false);
});

test("evidence: evidence not present in empty answer is invalid", () => {
  const res = validateEvidence({ evidenceText: "apapun", answer: "" });
  assert.equal(res.valid, false);
  assert.equal(res.reason, "NOT_FOUND");
});

test("evidence: evidence longer than allowed is invalid", () => {
  const long = "x".repeat(2001);
  const res = validateEvidence({ evidenceText: long, answer: long });
  assert.equal(res.valid, false);
  assert.equal(res.reason, "TOO_LONG");
});

// ---------------------------------------------------------------------------
// locateEvidence span correctness
// ---------------------------------------------------------------------------

test("locateEvidence returns correct offsets and original-case matched text", () => {
  const span = locateEvidence("diafragma berkontraksi", ANSWER);
  assert.ok(span);
  assert.equal(span.start, 0);
  assert.equal(span.end, 22);
  assert.equal(span.matched, "Diafragma berkontraksi");
});

test("locateEvidence returns null when absent", () => {
  assert.equal(locateEvidence("frase yang tidak ada", ANSWER), null);
});

// ---------------------------------------------------------------------------
// Multiple evidence spans
// ---------------------------------------------------------------------------

test("evidenceList: all valid returns valid with spans", () => {
  const res = validateEvidenceList({
    evidenceList: [{ text: "Diafragma berkontraksi" }, "volume paru meningkat"],
    answer: ANSWER,
  });
  assert.equal(res.valid, true);
  assert.equal(res.validCount, 2);
  assert.equal(res.invalid.length, 0);
  assert.equal(res.spans.length, 2);
});

test("evidenceList: one invalid makes the whole list invalid", () => {
  const res = validateEvidenceList({
    evidenceList: [{ text: "Diafragma berkontraksi" }, { text: "parafrase tidak ada di jawaban" }],
    answer: ANSWER,
  });
  assert.equal(res.valid, false);
  assert.equal(res.validCount, 1);
  assert.equal(res.invalid.length, 1);
  assert.equal(res.invalid[0].reason, "NOT_FOUND");
});

test("evidenceList: empty list is invalid", () => {
  const res = validateEvidenceList({ evidenceList: [], answer: ANSWER });
  assert.equal(res.valid, false);
});

test("evidenceList: plain string evidence entries supported", () => {
  const res = validateEvidenceList({ evidenceList: ["Diafragma berkontraksi", "paru meningkat"], answer: ANSWER });
  assert.equal(res.valid, true);
  assert.equal(res.validCount, 2);
});