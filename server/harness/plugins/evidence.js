/**
 * Evidence plugin — after the model returns, verifies that evidence is
 * grounded in the student's actual response.
 *
 * PRD FR-01 (Evidence Contamination Fix):
 *   Grounding corpus = Student Answer ONLY. The ideal/reference answer is
 *   NEVER used to prove that a student stated something. It may be used for
 *   evaluation context/comparison, but never for grounding.
 *
 * PRD FR-02 (Evidence Object v2):
 *   Each evidence carries provenance: criterionId, text, answerIndex,
 *   start/end offsets, grounded, groundingMethod, confidence.
 *
 * PRD FR-03 (Criterion-Evidence Mapping):
 *   Every scored criterion must have evidence or an explicit `no_evidence`
 *   marker. A criterion without evidence must not silently earn a high score.
 */
module.exports = {
  name: "evidence",
  version: "2.0.0",
  async after(context, result) {
    if (!result || !Array.isArray(result.criteria)) return result;
    const answers = gatherAnswers(context);
    for (const criterion of result.criteria) {
      if (!Array.isArray(criterion.evidence)) continue;
      criterion.evidence = criterion.evidence.map((ev) =>
        buildEvidence(ev, criterion.criterionId, answers)
      );
      criterion.evidenceCount = criterion.evidence.length;
      // FR-03: explicit no_evidence marker when a criterion has no evidence.
      if (criterion.evidence.length === 0) {
        criterion.noEvidence = true;
      }
    }
    context.trace &&
      context.trace.event("EVIDENCE_EXTRACTED", {
        totalEvidence: result.criteria.reduce((acc, c) => acc + (c.evidence ? c.evidence.length : 0), 0),
        noEvidenceCriteria: result.criteria.filter((c) => c.noEvidence).length,
      });
    return result;
  },
};

/**
 * Gather the grounding corpus from the student's answers ONLY.
 * Ideal/reference answers are intentionally excluded (FR-01).
 * Returns an array of { text, answerIndex } so provenance can be attached.
 */
function gatherAnswers(context) {
  const answers = (context.input && context.input.answers) || [];
  return answers.map((a, idx) => ({
    text: String(a || "").toLowerCase(),
    answerIndex: idx,
  }));
}

/**
 * Build an Evidence Object v2 with full provenance.
 * Grounding is lexical (FR-02 initial groundingMethod).
 */
function buildEvidence(ev, criterionId, answers) {
  const text = String((ev && ev.text) || "").trim();
  const found = findInAnswers(text, answers);
  const grounded = found !== null;
  return {
    criterionId: criterionId || (ev && ev.criterionId) || null,
    text,
    answerIndex: grounded ? found.answerIndex : null,
    start: grounded ? found.start : null,
    end: grounded ? found.end : null,
    grounded,
    groundingMethod: grounded ? "lexical" : null,
    confidence: grounded ? lexicalConfidence(text, found) : 0,
  };
}

/**
 * Locate the evidence text within the student answers (case-insensitive).
 * Returns { answerIndex, start, end } or null when not found.
 */
function findInAnswers(evidenceText, answers) {
  if (!evidenceText) return null;
  const phrase = evidenceText.toLowerCase();
  for (let i = 0; i < answers.length; i += 1) {
    const idx = answers[i].text.indexOf(phrase);
    if (idx !== -1) {
      return { answerIndex: answers[i].answerIndex, start: idx, end: idx + phrase.length };
    }
  }
  return null;
}

/**
 * Lexical confidence: exact full-phrase match is strongest; a truncated
 * phrase (evidence longer than the match window) is slightly weaker.
 */
function lexicalConfidence(evidenceText, found) {
  const length = evidenceText.length;
  const matched = found.end - found.start;
  if (length === 0) return 0;
  const ratio = Math.min(1, matched / length);
  return Math.round(ratio * 100) / 100;
}