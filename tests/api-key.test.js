const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

process.env.TURSO_DATABASE_URL = `file:${path.join(os.tmpdir(), `oralai-apikey-${Date.now()}.db`)}`;
process.env.ENABLE_DEMO_SIMULATION = "false";

const { initDatabase, getDb } = require("../server/database");
const {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  resolveApiKey,
  hashKey,
} = require("../server/api-key-service");
const { authenticateApiKey } = require("../server/api-auth");
const {
  registerTenantUser,
  createSession,
  getSessionUser,
} = require("../server/auth-service");
// The /api/apikeys HTTP handler still lives in the not-yet-extracted
// api-internal/ layer, so the admin-role gate is asserted against the helper
// that enforces it (same function the handler calls).
const { requireRoles } = require("../server/http/request-security");
const v1Api = require("../api/v1");

let context;

test.before(async () => {
  const dbPath = process.env.TURSO_DATABASE_URL.replace(/^file:/, "");
  fs.rmSync(dbPath, { force: true });
  await initDatabase();
  context = await seedScenario();
});

test("createApiKey generates a key with the correct prefix and stores a hash", async () => {
  const { rawKey, record } = await createApiKey(context.tenant.id, { name: "Test Key", createdBy: context.admin.id });

  assert.ok(rawKey.startsWith("lsk_"));
  assert.equal(record.name, "Test Key");
  assert.equal(record.prefix, rawKey.slice(0, 12));

  // The stored hash should not equal the raw key.
  const row = await getDb().get("SELECT key_hash FROM api_keys WHERE id = ?", record.id);
  assert.equal(row.key_hash, hashKey(rawKey));
  assert.notEqual(row.key_hash, rawKey);
});

test("resolveApiKey returns the tenant for a valid key", async () => {
  const { rawKey } = await createApiKey(context.tenant.id, { name: "Resolve Key" });
  const resolved = await resolveApiKey(rawKey);
  assert.equal(resolved.tenantId, context.tenant.id);
  assert.ok(resolved.keyId);
});

test("resolveApiKey returns null for an invalid or revoked key", async () => {
  assert.equal(await resolveApiKey("invalid-key"), null);
  assert.equal(await resolveApiKey("lsk_invalid"), null);

  const { rawKey, record } = await createApiKey(context.tenant.id, { name: "Revoke Me" });
  await revokeApiKey(context.tenant.id, record.id);
  assert.equal(await resolveApiKey(rawKey), null);
});

test("listApiKeys returns only non-revoked keys for the tenant", async () => {
  const { record: k1 } = await createApiKey(context.tenant.id, { name: "List Key 1" });
  const { record: k2 } = await createApiKey(context.tenant.id, { name: "List Key 2" });
  await revokeApiKey(context.tenant.id, k2.id);

  const keys = await listApiKeys(context.tenant.id);
  assert.ok(keys.some((k) => k.id === k1.id));
  assert.ok(!keys.some((k) => k.id === k2.id));
});

test("authenticateApiKey extracts and resolves a Bearer token", async () => {
  const { rawKey } = await createApiKey(context.tenant.id, { name: "Bearer Key" });
  const req = { headers: { authorization: `Bearer ${rawKey}` } };
  const result = await authenticateApiKey(req);
  assert.equal(result.tenantId, context.tenant.id);
});

test("apikeys management requires admin role", async () => {
  // Student cannot access.
  const studentSession = await createSession(context.student.id);
  const studentAuth = await getSessionUser(studentSession.token);
  const resStudent = fakeResponse();
  assert.equal(requireRoles(resStudent, studentAuth, ["admin"]), false);
  assert.equal(resStudent.statusCode, 403);

  // Admin passes the gate and can list the tenant's keys.
  const adminSession = await createSession(context.admin.id);
  const adminAuth = await getSessionUser(adminSession.token);
  const resAdmin = fakeResponse();
  assert.equal(requireRoles(resAdmin, adminAuth, ["admin"]), true);
  assert.equal(resAdmin.statusCode, 0, "admin must not receive an error response");
  assert.ok(Array.isArray(await listApiKeys(context.tenant.id)));
});

test("admin can create an API key for the tenant", async () => {
  const adminSession = await createSession(context.admin.id);
  const adminAuth = await getSessionUser(adminSession.token);
  assert.equal(requireRoles(fakeResponse(), adminAuth, ["admin"]), true);

  const { rawKey, record } = await createApiKey(context.tenant.id, { name: "Via API" });

  assert.equal(record.name, "Via API");
  assert.ok(rawKey.startsWith("lsk_"));
});

test("v1 API rejects requests without a valid API key", async () => {
  const res = await callHandler(v1Api, {
    method: "GET",
    url: "/api/v1/assessments",
  });
  assert.equal(res.statusCode, 401);
});

test("v1 API lists assessments with a valid API key", async () => {
  const { rawKey } = await createApiKey(context.tenant.id, { name: "V1 Key" });
  const res = await callHandler(v1Api, {
    method: "GET",
    url: "/api/v1/assessments",
    headers: { authorization: `Bearer ${rawKey}` },
  });
  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.assessments));
});

async function seedScenario() {
  const { tenant, user: admin } = await registerTenantUser({
    tenantName: "API Key School",
    name: "Admin API",
    email: "admin.apikey@example.com",
    password: "password123",
  });
  const student = await require("../server/auth-service").createTenantUser(tenant.id, {
    name: "Siswa API",
    email: "siswa.apikey@example.com",
    password: "password123",
    role: "student",
  });
  return { tenant, admin, student };
}

function fakeResponse() {
  return {
    headers: {},
    statusCode: 0,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    writeHead(statusCode, responseHeaders = {}) {
      this.statusCode = statusCode;
      Object.entries(responseHeaders).forEach(([name, value]) => this.setHeader(name, value));
    },
    end(payload = "") {
      this.rawBody = String(payload);
      this.body = this.rawBody ? JSON.parse(this.rawBody) : {};
    },
  };
}

function callHandler(handler, { method, url, body, headers = {} }) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = { host: "127.0.0.1:4173", ...headers };

  const res = {
    headers: {},
    statusCode: 0,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
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

  const done = new Promise((resolve) => { res.resolve = resolve; });
  handler(req, res);
  setTimeout(() => {
    if (body) req.emit("data", Buffer.from(JSON.stringify(body)));
    req.emit("end");
  }, 15);
  return done;
}