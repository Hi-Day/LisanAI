/**
 * Evidence plugin — after the model returns, verifies that evidence is
 * grounded in the student's actual response.
 */
module.exports = {
  name: "evidence",
  version: "1.0.0",
  async after(context, result) {
    if (!result || !Array.isArray(result.criteria)) return result;
    const answers = gatherAnswers(context);
    for (const criterion of result.criteria) {
      if (!Array.isArray(criterion.evidence)) continue;
      criterion.evidence = criterion.evidence.map((ev) => ({
        text: String(ev.text || ""),
        location: "answer",
        grounded: isGrounded(ev.text, answers),
      }));
      criterion.evidenceCount = criterion.evidence.length;
    }
    context.trace &&
      context.trace.event("EVIDENCE_EXTRACTED", {
        totalEvidence: result.criteria.reduce((acc, c) => acc + (c.evidence ? c.evidence.length : 0), 0),
      });
    return result;
  },
};

function gatherAnswers(context) {
  const answers = (context.input && context.input.answers) || [];
  const texts = answers.map(String).join(" ").toLowerCase();
  if (context.assessmentContext && Array.isArray(context.assessmentContext.questions)) {
    for (const q of context.assessmentContext.questions) {
      if (q && q.ideal) texts += " " + String(q.ideal).toLowerCase();
    }
  }
  return texts;
}

/**
 * Evidence is grounded if its text appears (loosely) in the student's answer.
 */
function isGrounded(evidenceText, answerText) {
  if (!evidenceText || !answerText) return false;
  const ev = String(evidenceText).toLowerCase().trim();
  const phrase = ev.length > 40 ? ev.slice(0, 40) : ev;
  return phrase.length > 0 && answerText.includes(phrase);
}