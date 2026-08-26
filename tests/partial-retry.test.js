const test = require("node:test");
const assert = require("node:assert/strict");

const { evaluateWithRetry, isRetryableError } = require("../server/harness/partial-retry");

function okResult() {
  return { status: "ok", score: 80 };
}

// ---------------------------------------------------------------------------
// Basic success / retry
// ---------------------------------------------------------------------------

test("retry: succeeds on first attempt", async () => {
  let calls = 0;
  const res = await evaluateWithRetry({ questionId: "q1" }, async () => { calls += 1; return okResult(); }, 1);
  assert.equal(res.status, "ok");
  assert.equal(calls, 1);
  assert.equal(res.attempts, 1);
});

test("retry: only the failed question is retried, not the successful ones", async () => {
  // This coordinator is per-question; verify a failing question is retried
  // while a concurrent successful one is not re-invoked.
  let q1Calls = 0;
  let q2Calls = 0;
  const res1 = await evaluateWithRetry({ questionId: "q1" }, async (q, attempt) => {
    q1Calls += 1;
    if (attempt === 1) { const e = new Error("malformed JSON"); e.reason = "MALFORMED_JSON"; throw e; }
    return okResult();
  }, 1);
  const res2 = await evaluateWithRetry({ questionId: "q2" }, async () => { q2Calls += 1; return okResult(); }, 1);
  assert.equal(res1.status, "ok");
  assert.equal(q1Calls, 2, "q1 should be retried");
  assert.equal(q2Calls, 1, "q2 should NOT be re-invoked");
  assert.deepEqual(res1.retries, [{ attempt: 1, reason: "MALFORMED_JSON" }]);
});

test("retry: retryable error with maxRetries=0 fails immediately", async () => {
  let calls = 0;
  const res = await evaluateWithRetry({ questionId: "q1" }, async () => {
    calls += 1;
    const e = new Error("timeout"); e.reason = "PROVIDER_TIMEOUT"; throw e;
  }, 0);
  assert.equal(calls, 1);
  assert.equal(res.status, "review"); // retryable exhausted -> review
});

// ---------------------------------------------------------------------------
// Retry exhaustion -> review
// ---------------------------------------------------------------------------

test("retry: malformed JSON retried once then success", async () => {
  let calls = 0;
  const res = await evaluateWithRetry({ questionId: "q3" }, async (q, attempt) => {
    calls += 1;
    if (attempt === 1) { const e = new Error("parse error"); e.reason = "MALFORMED_JSON"; throw e; }
    return okResult();
  }, 1);
  assert.equal(res.status, "ok");
  assert.equal(calls, 2);
});

test("retry: retry exhaustion after maxRetries yields review status", async () => {
  let calls = 0;
  const res = await evaluateWithRetry({ questionId: "q4" }, async (q, attempt) => {
    calls += 1;
    const e = new Error("invalid evidence"); e.reason = "EVIDENCE_INVALID"; throw e;
  }, 1);
  assert.equal(res.status, "review");
  assert.equal(calls, 2);
  assert.equal(res.reason, "EVIDENCE_INVALID");
});

// ---------------------------------------------------------------------------
// Non-retryable errors
// ---------------------------------------------------------------------------

test("retry: non-retryable error fails immediately, never retried", async () => {
  let calls = 0;
  const res = await evaluateWithRetry({ questionId: "q5" }, async () => {
    calls += 1;
    const e = new Error("assessment tidak ditemukan"); e.reason = "ASSESSMENT_NOT_FOUND"; throw e;
  }, 1);
  assert.equal(calls, 1, "non-retryable must not be retried");
  assert.equal(res.status, "error");
});

test("isRetryableError: recognizes known retryable reasons", () => {
  assert.equal(isRetryableError({ reason: "MALFORMED_JSON" }), true);
  assert.equal(isRetryableError({ reason: "EVIDENCE_INVALID" }), true);
  assert.equal(isRetryableError({ reason: "VERIFICATION_FAIL" }), true);
  assert.equal(isRetryableError({ reason: "PROVIDER_TIMEOUT" }), true);
});

test("isRetryableError: recognizes non-retryable reasons", () => {
  assert.equal(isRetryableError({ reason: "ASSESSMENT_NOT_FOUND" }), false);
  assert.equal(isRetryableError({ reason: "AUTH_FAILURE" }), false);
  assert.equal(isRetryableError({ reason: "RUBRIC_INVALID" }), false);
  assert.equal(isRetryableError({ message: "server 500 error" }), true);
});

test("retry: deterministic result failure (not throw) with reason triggers retry", async () => {
  let calls = 0;
  const res = await evaluateWithRetry({ questionId: "q6" }, async (q, attempt) => {
    calls += 1;
    if (attempt === 1) return { status: "error", reason: "VERIFICATION_FAIL" };
    return okResult();
  }, 1);
  assert.equal(res.status, "ok");
  assert.equal(calls, 2);
});