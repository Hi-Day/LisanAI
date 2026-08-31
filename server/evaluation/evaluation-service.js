/**
 * Application service boundary for assessment evaluation.
 *
 * HTTP/API layers should depend on this module rather than importing the
 * Harness implementation directly. This keeps the evaluation engine
 * replaceable while preserving the existing frontend contract.
 */
const { evaluateWithHarness } = require("../harness/harness-evaluator");

/**
 * Evaluate a submitted assessment through the single production evaluation
 * engine (Assessment Harness).
 */
async function evaluateAssessment(payload = {}) {
  return evaluateWithHarness(payload);
}

/**
 * Evaluate an assessment while reporting human-readable progress to the
 * caller. The progress callback is deliberately part of the application
 * service contract, not the HTTP/SSE implementation.
 */
async function evaluateAssessmentWithProgress(payload = {}, onProgress) {
  return evaluateWithHarness({
    ...payload,
    onProgress: typeof onProgress === "function" ? onProgress : undefined,
  });
}

module.exports = {
  evaluateAssessment,
  evaluateAssessmentWithProgress,
};
