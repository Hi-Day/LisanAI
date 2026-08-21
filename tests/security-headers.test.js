const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

process.env.TURSO_DATABASE_URL = `file:${path.join(os.tmpdir(), `oralai-security-${Date.now()}.db`)}`;
process.env.ENABLE_DEMO_SIMULATION = "false";

const { initDatabase } = require("../server/database");
const { SECURITY_HEADERS, applySecurityHeaders } = require("../server/security-headers");
const { sendJson } = require("../server/http-utils");
const { serveStaticFile } = require("../server/static");
const { callOpenRouter, isRetryableStatus, fetchWithTimeout } = require("../server/openrouter");

let originalFetch;
let originalApiKey;

test.before(async () => {
  const dbPath = process.env.TURSO_DATABASE_URL.replace(/^file:/, "");
  fs.rmSync(dbPath, { force: true });
  await initDatabase();
});

test.beforeEach(() => {
  originalFetch = global.fetch;
  originalApiKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-key";
});

test.afterEach(() => {
  global.fetch = originalFetch;
  process.env.OPENROUTER_API_KEY = originalApiKey;
});

// ---------------------------------------------------------------------------
// SECURITY HEADERS
// ---------------------------------------------------------------------------

test("security headers include CSP, nosniff, frame options, and referrer policy", () => {
  assert.ok(SECURITY_HEADERS["Content-Security-Policy"]);
  assert.match(SECURITY_HEADERS["Content-Security-Policy"], /default-src 'self'/);
  assert.match(SECURITY_HEADERS["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.equal(SECURITY_HEADERS["X-Content-Type-Options"], "nosniff");
  assert.equal(SECURITY_HEADERS["X-Frame-Options"], "DENY");
  assert.equal(SECURITY_HEADERS["Referrer-Policy"], "strict-origin-when-cross-origin");
});

test("applySecurityHeaders sets all headers on a response", () => {
  const res = { headers: {}, setHeader(name, value) { this.headers[name] = value; } };
  applySecurityHeaders(res);
  assert.equal(res.headers["Content-Security-Policy"], SECURITY_HEADERS["Content-Security-Policy"]);
  assert.equal(res.headers["X-Content-Type-Options"], "nosniff");
  assert.equal(res.headers["X-Frame-Options"], "DENY");
});

test("sendJson applies security headers to JSON responses", () => {
  const res = {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers); },
    end(payload) { this.body = JSON.parse(payload); },
  };
  sendJson(res, 200, { ok: true });
  assert.equal(res.headers["Content-Security-Policy"], SECURITY_HEADERS["Content-Security-Policy"]);
  assert.equal(res.headers["X-Content-Type-Options"], "nosniff");
});

test("serveStaticFile applies security headers to static assets", () => {
  const res = new EventEmitter();
  res.statusCode = 0;
  res.headers = {};
  res.setHeader = function (name, value) { this.headers[name] = value; };
  res.writeHead = function (status, headers) { this.statusCode = status; Object.assign(this.headers, headers); };
  res.write = function () { return true; };
  res.end = function () {};
  const root = path.join(__dirname, "..");
  serveStaticFile(res, root, "/index.html");
  assert.equal(res.headers["Content-Security-Policy"], SECURITY_HEADERS["Content-Security-Policy"]);
  assert.equal(res.headers["X-Content-Type-Options"], "nosniff");
});

// ---------------------------------------------------------------------------
// TIMEOUT & RETRY
// ---------------------------------------------------------------------------

test("isRetryableStatus returns true for 429 and 5xx", () => {
  assert.equal(isRetryableStatus(429), true);
  assert.equal(isRetryableStatus(500), true);
  assert.equal(isRetryableStatus(503), true);
  assert.equal(isRetryableStatus(400), false);
  assert.equal(isRetryableStatus(401), false);
});

test("fetchWithTimeout aborts after the timeout", async () => {
  // A fetch that respects the abort signal and never resolves otherwise.
  global.fetch = (_url, options) =>
    new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        const err = new Error("The operation was aborted");
        err.name = "AbortError";
        reject(err);
      });
    });
  await assert.rejects(
    () => fetchWithTimeout("http://example.com", {}, 50),
    (err) => err.name === "AbortError"
  );
});

test("callOpenRouter retries a 429 then succeeds", async () => {
  let attempts = 0;
  global.fetch = async () => {
    attempts += 1;
    if (attempts === 1) {
      return { ok: false, status: 429, json: async () => ({ error: { message: "rate limited" } }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"ok":true}' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    };
  };

  const result = await callOpenRouter(
    [{ role: "user", content: '{"jumlah_soal":1,"topik":"AI"}' }],
    "return valid JSON",
    { tenantId: "tenant-retry", userId: "user-retry", action: "generate-questions" }
  );

  assert.deepEqual(result, { ok: true });
  assert.ok(attempts >= 2, `expected retry, got ${attempts} attempts`);
});

test("callOpenRouter falls back to the fallback model when primary fails", async () => {
  const attempts = [];
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    attempts.push(body.model);
    if (body.model === "google/gemini-2.5-flash") {
      return { ok: false, status: 500, json: async () => ({ error: { message: "unavailable" } }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"ok":true}' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    };
  };

  const result = await callOpenRouter(
    [{ role: "user", content: '{"jumlah_soal":1,"topik":"AI"}' }],
    "return valid JSON",
    { tenantId: "tenant-fallback2", userId: "user-fallback2", action: "generate-questions" }
  );

  assert.deepEqual(result, { ok: true });
  assert.ok(attempts.includes("nvidia/nemotron-3-super-120b-a12b:free"));
});