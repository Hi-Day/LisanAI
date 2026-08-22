/**
 * Assessment Context plugin — injects server-side assessment metadata
 * (course, topic, learning outcome, question, expected competency).
 * Client cannot influence this context.
 */
module.exports = {
  name: "assessmentContext",
  version: "1.0.0",
  async before(context) {
    const assessment = context.assessment;
    context.assessmentContext = {
      topic: (assessment && assessment.topic) || "",
      outcomes: (assessment && assessment.outcomes) || "",
      questions: (assessment && assessment.questions) || [],
      difficulty: (assessment && assessment.difficulty) || "Menengah",
    };
    context.trace &&
      context.trace.event("CONTEXT_BUILT", {
        questionCount: context.assessmentContext.questions.length,
      });
    return context;
  },
};