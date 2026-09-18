const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

process.env.TURSO_DATABASE_URL = `file:${path.join(os.tmpdir(), `lisan-auth-hardening-${Date.now()}.db`)}`;
process.env.ENABLE_DEMO_SIMULATION = "false";

const authApi = require("../api/auth");
const { initDatabase } = require("../server/database");
const { createCsrfToken, SESSION_COOKIE } = require("../server/auth-service");
const { resetRateLimits } = require("../server/rate-limit");

test.before(async () => {
  const dbPath = process.env.TURSO_DATABASE_URL.replace(/^file:/, "");
  fs.rmSync(dbPath, { force: true });
  await initDatabase();
});

test.beforeEach(() => {
  resetRateLimits();
});

test("register response sets an HttpOnly session cookie", async () => {
  const response = await callHandler(authApi, {
    method: "POST",
    url: "/api/auth",
    body: {
      action: "register",
      payload: {
        tenantName: "Cookie Test School",
        name: "Admin Cookie",
        email: "admin.cookie.test@example.com",
        password: "password123",
      },
    },
  });

  assert.equal(response.statusCode, 201);
  const cookie = response.headers["set-cookie"];
  assert.match(cookie, new RegExp(`^${SESSION_COOKIE}=`));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
});

test("logout clears the session cookie with HttpOnly and Max-Age=0", async () => {
  const response = await callHandler(authApi, {
    method: "POST",
    url: "/api/auth",
    body: { action: "logout", payload: {} },
  });

  assert.equal(response.statusCode, 200);
  const cookie = response.headers["set-cookie"];
  assert.match(cookie, new RegExp(`^${SESSION_COOKIE}=;`));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Max-Age=0/);
});

test("createCsrfToken returns null without a session id", () => {
  assert.equal(createCsrfToken(null), null);
  assert.equal(createCsrfToken({}), null);
});

test("createCsrfToken throws in production when CSRF_SECRET is missing", () => {
  withEnv({ CSRF_SECRET: undefined, VERCEL_ENV: "production", NODE_ENV: undefined }, () => {
    assert.throws(
      () => createCsrfToken({ sessionId: "session-missing-secret" }),
      /CSRF_SECRET wajib diatur di produksi/
    );
  });
});

test("createCsrfToken throws in production when NODE_ENV is production", () => {
  withEnv({ CSRF_SECRET: undefined, VERCEL_ENV: undefined, NODE_ENV: "production" }, () => {
    assert.throws(() => createCsrfToken({ sessionId: "session-node-prod" }));
  });
});

test("createCsrfToken uses the dev fallback outside production when CSRF_SECRET is unset", () => {
  withEnv({ CSRF_SECRET: undefined, VERCEL_ENV: undefined, NODE_ENV: "test" }, () => {
    const token = createCsrfToken({ sessionId: "session-dev" });
    assert.match(token, /^[a-f0-9]{64}$/);
    assert.equal(token, createCsrfToken({ sessionId: "session-dev" }), "dev fallback must be deterministic");
  });
});

test("createCsrfToken honors CSRF_SECRET in production", () => {
  const secret = "a".repeat(32);
  withEnv({ CSRF_SECRET: secret, VERCEL_ENV: "production", NODE_ENV: "production" }, () => {
    const token = createCsrfToken({ sessionId: "session-prod" });
    assert.match(token, /^[a-f0-9]{64}$/);
    assert.equal(token, createCsrfToken({ sessionId: "session-prod" }));
  });
});

function withEnv(overrides, fn) {
  const keys = Object.keys(overrides);
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return fn();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function callHandler(handler, { method, url, body, headers = {} }) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = { host: "127.0.0.1:4173", ...headers };

  const res = {
    headers: {},
    statusCode: 0,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    writeHead(statusCode, responseHeaders = {}) {
      this.statusCode = statusCode;
      Object.entries(responseHeaders).forEach(([name, value]) => this.setHeader(name, value));
    },
    end(payload = "") {
      this.rawBody = String(payload);
      this.body = this.rawBody ? JSON.parse(this.rawBody) : {};
      this.resolve(this);
    },
  };

  const done = new Promise((resolve) => {
    res.resolve = resolve;
  });

  handler(req, res);

  setTimeout(() => {
    if (body) req.emit("data", Buffer.from(JSON.stringify(body)));
    req.emit("end");
  }, 15);

  return done;
}
