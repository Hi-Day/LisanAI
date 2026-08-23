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
      // Normalize each evidence entry to a string, then build a v2 object.
      const normalized = [];
      for (const ev of criterion.evidence) {
        const text = extractEvidenceText(ev);
        if (!text) continue;
        normalized.push(buildEvidence(text, criterion.criterionId, answers));
      }
      criterion.evidence = normalized;
      criterion.evidenceCount = criterion.evidence.length;
      // FR-03/FR-06: explicit marker & status when a criterion has no evidence.
      if (criterion.evidence.length === 0) {
        criterion.noEvidence = true;
        criterion.evidenceStatus = "MISSING";
      } else if (criterion.evidence.some((ev) => ev && ev.grounded)) {
        criterion.evidenceStatus = "GROUNDED";
      } else {
        criterion.evidenceStatus = "UNSUPPORTED";
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
 * Extract a plain text string from any evidence shape the model may return:
 *   - string          "fragmen jawaban"
 *   - { text }        (canonical)
 *   - { quote }       { statement }  { evidence }
 *   - array           ["a","b"] -> joined (defensive)
 * Returns empty string when nothing usable.
 */
function extractEvidenceText(ev) {
  if (ev == null) return "";
  if (typeof ev === "string") return ev.trim();
  if (typeof ev === "object") {
    for (const key of ["text", "quote", "statement", "content", "excerpt", "snippet"]) {
      if (typeof ev[key] === "string" && ev[key].trim()) return ev[key].trim();
    }
    if (Array.isArray(ev)) {
      return ev.map((x) => extractEvidenceText(x)).filter(Boolean).join(" ");
    }
  }
  return "";
}

/**
 * Build an Evidence Object v2 with full provenance.
 * Grounding is lexical (FR-02 initial groundingMethod).
 */
function buildEvidence(text, criterionId, answers) {
  const found = findInAnswers(text, answers);
  const grounded = found !== null;
  return {
    criterionId,
    text,
    answerIndex: grounded ? found.answerIndex : null,
    start: grounded ? found.start : null,
    end: grounded ? found.end : null,
    grounded,
    groundingMethod: grounded ? "lexical" : null,
    confidence: grounded ? lexicalConfidence(text, found) : 0,
    // PRD FR-06 — evidence status enum: GROUNDED | UNSUPPORTED | MISSING.
    // (criterion-level MISSING is stamped on the criterion by the plugin.)
    status: grounded ? "GROUNDED" : "UNSUPPORTED",
  };
}

/**
 * Locate the evidence text within the student answers (case-insensitive).
 * Returns { answerIndex, start, end } or null when not found.
 *
 * Grounding is lexical but tolerant: first it tries the full phrase; if the
 * exact phrase is absent, it falls back to the longest run of adjacent words
 * (>=2) that does appear in the student answer. This keeps evidence grounded
 * in genuinely-copied fragments without accepting paraphrases (FR-01 — never
 * seeds from ideal answer; only the student corpus is searched).
 *
 * Robustness (P0): the returned span is always validated so that
 *   0 <= start <= end <= answer.length
 * and the matched window is a genuine substring of the student answer. A
 * degenerate window (empty, or longer than the answer) is never returned.
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
  // Fallback: longest contiguous word-run present in a student answer.
  const words = phrase.split(/\s+/).filter((w) => w.length > 2);
  if (words.length < 2) return null;
  for (let len = words.length; len >= 2; len -= 1) {
    for (let s = 0; s + len <= words.length; s += 1) {
      const window = words.slice(s, s + len).join(" ");
      for (let i = 0; i < answers.length; i += 1) {
        const idx = answers[i].text.indexOf(window);
        if (idx !== -1) {
          return { answerIndex: answers[i].answerIndex, start: idx, end: idx + window.length };
        }
      }
    }
  }
  return null;
}

/**
 * Lexical confidence: exact full-phrase match is strongest; a truncated
 * phrase (evidence longer than the match window) is slightly weaker.
 * The ratio is clamped to [0,1] so a malformed span can never yield >1.
 */
function lexicalConfidence(evidenceText, found) {
  const length = evidenceText.length;
  const matched = found.end - found.start;
  if (length === 0) return 0;
  const ratio = Math.min(1, Math.max(0, matched / length));
  return Math.round(ratio * 100) / 100;
}