/**
 * Evaluation plugin — instructs the pipeline how the model should be asked
 * to produce criterion-level evaluations (score, evidence, rationale, confidence).
 * The LLM never computes the final weighted score.
 */
const EVALUATION_SCHEMA_HINT = [
  '{"criteria":[{"criterionId":"...","score":0-100,"evidence":[{"text":"..."}],"rationale":"...","confidence":0.0-1.0}]}',
  "Balas hanya JSON valid tanpa markdown. Tidak menghitung finalScore.",
].join(" ");

module.exports = {
  name: "evaluation",
  version: "1.0.0",
  async before(context) {
    context.evaluationHint = EVALUATION_SCHEMA_HINT;
    return context;
  },
};

module.exports.EVALUATION_SCHEMA_HINT = EVALUATION_SCHEMA_HINT;