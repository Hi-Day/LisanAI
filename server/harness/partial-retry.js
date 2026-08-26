/**
 * Partial Retry coordinator (PRD P0-5)
 *
 * When evaluation of one question fails, ONLY that question is retried — never
 * the questions that already succeeded. This isolates failures (G3) and avoids
 * re-invoking the LLM for unrelated questions.
 *
 * Retryable errors (deterministic, safe to re-attempt):
 *   - malformed JSON / parse failure
 *   - missing required criterion
 *   - invalid score
 *   - invalid evidence (EVIDENCE_INVALID)
 *   - verification failure
 *   - provider transient failure (timeout / 5xx)
 *
 * Non-retryable errors (must not be retried):
 *   - assessment not found
 *   - rubric invalid
 *   - authentication / authorization failure
 *   - malformed request
 */

const DEFAULT_MAX_RETRIES = 1;

// Error reason tags that indicate a deterministic, retryable condition.
const RETRYABLE_REASONS = new Set([
  "MALFORMED_JSON",
  "MISSING_CRITERION",
  "INVALID_SCORE",
  "EVIDENCE_INVALID",
  "VERIFICATION_FAIL",
  "PROVIDER_TRANSIENT",
  "PROVIDER_TIMEOUT",
]);

function isRetryableError(error) {
  const reason = error && error.reason;
  if (RETRYABLE_REASONS.has(reason)) return true;
  const message = String((error && error.message) || "");
  if (/malformed|parse|verification|timeout|5\d\d|429/i.test(message)) return true;
  return false;
}

/**
 * Run one question through up to `maxRetries` attempts.
 * @param {object} question
 * @param {(q:object, attempt:number)=>Promise<object>} evaluate
 * @param {number} maxRetries
 * @returns {Promise<{
 *   questionId:string,
 *   attempts:number,
 *   result?:object,
 *   status:"success"|"failed"|"review",
 *   error?:Error,
 *   retries:Array<{attempt:number, reason:string}>,
 * }>}
 */
async function evaluateWithRetry(question, evaluate, maxRetries = DEFAULT_MAX_RETRIES) {
  const questionId = String(question.questionId || question.id || "?");
  const retries = [];
  let lastError = null;
  let attempts = 0;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    attempts += 1;
    try {
      const result = await evaluate(question, attempt);
      // A result that carries a deterministic retryable condition also triggers
      // a retry (e.g. invalid evidence surfaced as { status:'error', reason }).
      if (result && result.reason && RETRYABLE_REASONS.has(result.reason) && attempt <= maxRetries) {
        retries.push({ attempt, reason: result.reason });
        continue;
      }
      if (result && result.reason === "EVIDENCE_INVALID" && attempt > maxRetries) {
        return { questionId, attempts, status: "review", result, retries, reason: "EVIDENCE_INVALID" };
      }
      return { questionId, attempts, status: "ok", result, retries };
    } catch (error) {
      lastError = error;
      const reason = error && error.reason;
      const retryable = isRetryableError(error);
      if (retryable && attempt <= maxRetries) {
        retries.push({ attempt, reason: reason || "RETRYABLE" });
        continue;
      }
      if (retryable && attempt > maxRetries) {
        return { questionId, attempts, status: "review", error, retries, reason: reason || "RETRYABLE" };
      }
      // Non-retryable: fail immediately, never loop.
      return { questionId, attempts, status: "error", error, retries };
    }
  }
  return { questionId, attempts, status: "error", error: lastError, retries };
}

module.exports = { evaluateWithRetry, isRetryableError, RETRYABLE_REASONS, DEFAULT_MAX_RETRIES };