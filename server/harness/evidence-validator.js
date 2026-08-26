/**
 * Deterministic Evidence Validator (PRD P0-6 / P0-7)
 *
 * Guarantees that every piece of evidence used for scoring is verifiably a
 * substring of the student's answer. This is the P0 invariant that stops an
 * LLM from producing evidence that merely "looks plausible" but never appears
 * in the transcript.
 *
 * Rule (P0-6):
 *   for every evidence: evidence.text ⊆ studentAnswer  (case-normalized)
 *
 * - Case is normalized for VALIDATION, but the evidence that is displayed/
 *   persisted keeps its original transcript form.
 * - Provenance offsets (start/end) reference the ORIGINAL student answer.
 */

const MAX_EVIDENCE_LENGTH = 2000;

/**
 * Locate an evidence span inside the original student answer.
 * Returns { start, end, matched } where matched is the original-case substring,
 * or null when the evidence is not present.
 * @param {string} evidenceText
 * @param {string} answer  original transcript
 * @returns {{start:number,end:number,matched:string}|null}
 */
function locateEvidence(evidenceText, answer) {
  if (typeof evidenceText !== "string") return null;
  if (typeof answer !== "string") return null;

  const evidence = evidenceText.trim();
  if (!evidence || evidence.length > MAX_EVIDENCE_LENGTH) return null;
  if (!answer) return null;

  const lowerAnswer = answer.toLowerCase();
  const lowerEvidence = evidence.toLowerCase();
  const idx = lowerAnswer.indexOf(lowerEvidence);
  if (idx === -1) return null;
  return {
    start: idx,
    end: idx + evidence.length,
    matched: answer.slice(idx, idx + evidence.length),
  };
}

/**
 * Validate a single evidence against a single student answer.
 * @param {object} input
 * @param {string} input.evidenceText
 * @param {string} input.answer
 * @param {string} [input.criterionId]
 * @param {string} [input.questionId]
 * @returns {{
 *   valid: boolean,
 *   reason?: "EMPTY_EVIDENCE"|"NOT_FOUND"|"TOO_LONG",
 *   span: {start,end,matched}|null,
 *   normalizedValid: boolean,
 * }}
 */
function validateEvidence({ evidenceText, answer, criterionId, questionId } = {}) {
  if (evidenceText == null || String(evidenceText).trim() === "") {
    return { valid: false, reason: "EMPTY_EVIDENCE", span: null, normalizedValid: false };
  }
  if (String(evidenceText).length > MAX_EVIDENCE_LENGTH) {
    return { valid: false, reason: "TOO_LONG", span: null, normalizedValid: false };
  }
  const span = locateEvidence(String(evidenceText), String(answer || ""));
  if (!span) {
    return { valid: false, reason: "NOT_FOUND", span: null, normalizedValid: false };
  }
  return {
    valid: true,
    span,
    criterionId: criterionId || null,
    questionId: questionId || null,
    normalizedValid: true,
  };
}

/**
 * Validate a list of evidence objects (or strings) against a single answer.
 * Each evidence may be { text, ... } or a plain string.
 * @returns {{
 *   valid: boolean,        // all evidence valid
 *   validCount: number,
 *   invalid: Array<{index,reason,text}>,
 *   spans: Array<{index,text,start,end,matched}>,
 * }}
 */
function validateEvidenceList({ evidenceList, answer } = {}) {
  if (!Array.isArray(evidenceList)) {
    return { valid: false, validCount: 0, invalid: [{ index: 0, reason: "EMPTY_EVIDENCE" }], spans: [] };
  }
  // A criterion with NO evidence at all is invalid (P0-7: missing evidence).
  if (evidenceList.length === 0) {
    return { valid: false, validCount: 0, invalid: [{ index: 0, reason: "EMPTY_EVIDENCE" }], spans: [] };
  }
  const invalid = [];
  const spans = [];
  let validCount = 0;
  evidenceList.forEach((item, index) => {
    const text = typeof item === "string" ? item : item && (item.text || item.quote || item.statement || "");
    const res = validateEvidence({ evidenceText: text, answer });
    if (res.valid) {
      validCount += 1;
      spans.push({ index, text: String(text), span: res.span });
    } else {
      invalid.push({ index, reason: res.reason, text: String(text || "") });
    }
  });
  return {
    valid: validCount === evidenceList.length,
    validCount,
    invalid,
    spans,
  };
}

module.exports = {
  locateEvidence,
  validateEvidence,
  validateEvidenceList,
  MAX_EVIDENCE_LENGTH,
};