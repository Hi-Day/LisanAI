const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

process.env.TURSO_DATABASE_URL = `file:${path.join(os.tmpdir(), `oralai-health-${Date.now()}.db`)}`;
process.env.ENABLE_DEMO_SIMULATION = "false";

const stateApi = require("../api/state");
const { initDatabase } = require("../server/database");
const { createSession, registerTenantUser, SESSION_COOKIE } = require("../server/auth-service");

let sessionToken;

test.before(async () => {
  const dbPath = process.env.TURSO_DATABASE_URL.replace(/^file:/, "");
  fs.rmSync(dbPath, { force: true });
  await initDatabase();
  const { user } = await registerTenantUser({
    tenantName: "Health Test School",
    name: "Admin Health",
    email: "admin.health.test@example.com",
    password: "password123",
  });
  const session = await createSession(user.id);
  sessionToken = session.token;
});

test("authenticated /api/health returns a DB-backed readiness payload", async () => {
  const res = await callHandler(stateApi, {
    method: "GET",
    url: "/api/health",
    headers: { cookie: `${SESSION_COOKIE}=${sessionToken}` },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, "ok");
  assert.deepEqual(res.body.database, { ok: true });
  assert.ok(res.body.harness, "harness readiness must be reported");
  assert.equal(typeof res.body.harness.ready, "boolean");
  assert.ok(["mock", "openrouter"].includes(res.body.harness.provider));
  assert.equal(typeof res.body.timestamp, "string");
});

test("unauthenticated /api/health is rejected", async () => {
  const res = await callHandler(stateApi, { method: "GET", url: "/api/health" });
  assert.equal(res.statusCode, 401);
});

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
