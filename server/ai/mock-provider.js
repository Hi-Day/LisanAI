const { AIProvider } = require("./provider");

/**
 * Deterministic mock provider for tests, CI/CD, and frontend development.
 * Must NOT use Math.random(). Score is derived hash-electronically per answer.
 */
class MockProvider extends AIProvider {
  constructor() {
    super();
    this.name = "mock";
    this.version = "1.0.0";
  }

  /**
   * Deterministic pseudo-score from a string (stable across runs).
   */
  static hashScore(text, hint = 0) {
    let h = 0;
    const s = String(text || "").toLowerCase();
    for (let i = 0; i < s.length; i += 1) {
      h = (h * 31 + s.charCodeAt(i)) % 97;
    }
    const base = 72 + (h % 24); // 72..95 range
    return (base + hint) % 96;
  }

  /**
   * Produce a deterministic, valid harness output for each criterion.
   * Evidence is derived deterministically from the answer.
   */
  async generate(request) {
    const { prompt, runId } = request;
    let rubric = { criteria: [] };
    let answers = [];
    try {
      const p = JSON.parse(prompt);
      rubric = p.rubric || { criteria: [] };
      answers = p.answers || [];
    } catch {
      /* fall back to empty */
    }
    const criteria = (rubric.criteria || []).map((c, idx) => {
      const answer = answers[idx] || answers[0] || "";
      const score = MockProvider.hashScore(answer, idx);
      const excerpt = excerptText(answer, 32);
      return {
        criterionId: c.id,
        score,
        evidence: excerpt ? [{ text: excerpt, location: "answer" }] : [],
        rationale: `Evaluasi deterministik mock menurut '${c.name}'.`,
        confidence: 0.9,
        runId,
      };
    });
    return JSON.stringify({ criteria, rubric });
  }
}

function excerptText(text, max) {
  const s = String(text || "").trim();
  if (!s) return "";
  // Return a true substring of the answer (never append ellipsis) so that the
  // licensing-grounding plugin (FR-01/02) can match it lexically within the
  // student answer. An added "…" would never be found and would mark
  // otherwise valid evidence as ungrounded.
  return s.length > max ? s.slice(0, max) : s;
}

module.exports = { MockProvider };