const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

process.env.TURSO_DATABASE_URL = `file:${path.join(os.tmpdir(), `oralai-apikey-role-${Date.now()}.db`)}`;
process.env.ENABLE_DEMO_SIMULATION = "false";

const { initDatabase } = require("../server/database");
const { createApiKey } = require("../server/api-key-service");
const { registerTenantUser } = require("../server/auth-service");
const {
  authenticateRequest,
  requireAuthenticatedRequest,
  requireRoles,
} = require("../server/http/request-security");

let context;

test.before(async () => {
  const dbPath = process.env.TURSO_DATABASE_URL.replace(/^file:/, "");
  fs.rmSync(dbPath, { force: true });
  await initDatabase();

  const { tenant } = await registerTenantUser({
    tenantName: "API Key Role School",
    name: "Admin API Role",
    email: "admin.apikeyrole@example.com",
    password: "password123",
  });
  const { rawKey, record } = await createApiKey(tenant.id, { name: "Role Key" });
  context = { tenant, rawKey, keyId: record.id };
});

test.after(() => {
  const dbPath = process.env.TURSO_DATABASE_URL.replace(/^file:/, "");
  fs.rmSync(dbPath, { force: true });
});

test("API-key auth yields the non-privileged api role", async () => {
  const { auth, viaApiKey } = await authenticateRequest(
    fakeRequest({ authorization: `Bearer ${context.rawKey}` }),
    { allowApiKey: true }
  );

  assert.equal(viaApiKey, true);
  assert.ok(auth, "API key must authenticate when explicitly allowed");
  assert.equal(auth.user.role, "api");
  assert.notEqual(auth.user.role, "admin");
  assert.ok(auth.user.id.startsWith("apikey:"));
  assert.equal(auth.tenant.id, context.tenant.id);
});

test("requireRoles rejects the api role on every privileged whitelist", async () => {
  const { auth } = await authenticateRequest(
    fakeRequest({ authorization: `Bearer ${context.rawKey}` }),
    { allowApiKey: true }
  );

  const resAdmin = fakeResponse();
  assert.equal(requireRoles(resAdmin, auth, ["admin"]), false);
  assert.equal(resAdmin.statusCode, 403);

  const resTeacher = fakeResponse();
  assert.equal(requireRoles(resTeacher, auth, ["admin", "teacher", "student"]), false);
  assert.equal(resTeacher.statusCode, 403);
});

test("requireAuthenticatedRequest fails closed for API keys by default", async () => {
  const res = fakeResponse();
  const result = await requireAuthenticatedRequest(
    fakeRequest({ authorization: `Bearer ${context.rawKey}` }),
    res,
    {}
  );

  assert.equal(result, null);
  assert.equal(res.statusCode, 401);
});

function fakeRequest(headers = {}) {
  return { method: "GET", url: "/api/test", headers: { host: "127.0.0.1:4173", ...headers } };
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
