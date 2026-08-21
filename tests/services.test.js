const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

process.env.TURSO_DATABASE_URL = `file:${path.join(os.tmpdir(), `oralai-services-${Date.now()}.db`)}`;
process.env.ENABLE_DEMO_SIMULATION = "false";

const {
  createTenantUser,
  createTenantUsersBatch,
  createSession,
  createCsrfToken,
  deleteSession,
  extendSession,
  getSessionUser,
  assertCsrfToken,
  loginUser,
  registerTenantUser,
  updateTenantUser,
  deleteTenantUser,
  listTenantUsers,
  SESSION_COOKIE,
} = require("../server/auth-service");
const {
  getDb,
  initDatabase,
  createClass,
  requestJoinClass,
  approveMembership,
  saveAssessment,
  updateAssessment,
  deleteAssessment,
  saveSubmission,
  clearData,
  getState,
} = require("../server/database");
const { assertRateLimit, resetRateLimits } = require("../server/rate-limit");
const { parseCookies, readJson, sendJson, setCookie } = require("../server/http-utils");

let context;

test.before(async () => {
  const dbPath = process.env.TURSO_DATABASE_URL.replace(/^file:/, "");
  fs.rmSync(dbPath, { force: true });
  await initDatabase();
  context = await seedScenario();
});

test.beforeEach(() => {
  resetRateLimits();
});

// ---------------------------------------------------------------------------
// AUTH-SERVICE
// ---------------------------------------------------------------------------

test("registerTenantUser creates a tenant with an admin and hashes the password", async () => {
  const { tenant, user } = await registerTenantUser({
    tenantName: "Auth Test School",
    name: "Auth Admin",
    email: "auth.admin@example.com",
    password: "password123",
  });

  assert.ok(tenant.id);
  assert.equal(tenant.plan, "starter");
  assert.equal(user.role, "admin");

  const row = await getDb().get("SELECT password_hash FROM users WHERE id = ?", user.id);
  assert.match(row.password_hash, /^scrypt\$/);
  assert.notEqual(row.password_hash, "password123");
});

test("registerTenantUser rejects duplicate email with 409", async () => {
  await assert.rejects(
    () =>
      registerTenantUser({
        tenantName: "Dup School",
        name: "Dup Admin",
        email: "auth.admin@example.com",
        password: "password123",
      }),
    { status: 409 }
  );
});

test("registerTenantUser rejects weak password with 400", async () => {
  await assert.rejects(
    () =>
      registerTenantUser({
        tenantName: "Weak School",
        name: "Weak Admin",
        email: "weak.admin@example.com",
        password: "short",
      }),
    { status: 400 }
  );
});

test("loginUser returns tenant and user for valid credentials", async () => {
  const auth = await loginUser({ email: "auth.admin@example.com", password: "password123" });
  assert.equal(auth.user.email, "auth.admin@example.com");
  assert.equal(auth.user.role, "admin");
  assert.ok(auth.tenant.id);
});

test("loginUser rejects invalid password with 401", async () => {
  await assert.rejects(
    () => loginUser({ email: "auth.admin@example.com", password: "wrong-password" }),
    { status: 401 }
  );
});

test("createSession stores a hashed token and getSessionUser resolves it", async () => {
  const session = await createSession(context.student.id);
  assert.ok(session.token);
  assert.ok(session.sessionId);

  const auth = await getSessionUser(session.token);
  assert.equal(auth.user.id, context.student.id);
  assert.equal(auth.sessionId, session.sessionId);
});

test("getSessionUser returns null for an invalid token", async () => {
  const auth = await getSessionUser("invalid-token");
  assert.equal(auth, null);
});

test("extendSession renews the session expiry", async () => {
  const session = await createSession(context.student.id);
  const renewed = await extendSession(session.token);
  assert.ok(renewed);
});

test("deleteSession invalidates the token", async () => {
  const session = await createSession(context.student.id);
  await deleteSession(session.token);
  const auth = await getSessionUser(session.token);
  assert.equal(auth, null);
});

test("createCsrfToken and assertCsrfToken validate the header", () => {
  const auth = { sessionId: "session-123" };
  const token = createCsrfToken(auth);
  assert.ok(token);

  const req = { headers: { "x-csrf-token": token } };
  assert.doesNotThrow(() => assertCsrfToken(req, auth));

  const badReq = { headers: { "x-csrf-token": "wrong" } };
  assert.throws(() => assertCsrfToken(badReq, auth), { status: 403 });
});

test("createTenantUsersBatch returns per-row success and errors", async () => {
  const result = await createTenantUsersBatch(context.tenant.id, [
    { name: "Batch A", email: "batch.a@example.com", password: "password123", role: "student" },
    { name: "Batch B", email: "batch.a@example.com", password: "password123", role: "student" }, // duplicate
    { name: "Batch C", email: "batch.c@example.com", password: "password123", role: "student" },
  ]);

  assert.equal(result.success.length, 2);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /sudah terdaftar/);
});

test("updateTenantUser changes role and name", async () => {
  const user = await createTenantUser(context.tenant.id, {
    name: "Update Me",
    email: "update.me@example.com",
    password: "password123",
    role: "student",
  });
  const updated = await updateTenantUser(context.tenant.id, user.id, { name: "Updated Name", role: "teacher" });
  assert.equal(updated.name, "Updated Name");
  assert.equal(updated.role, "teacher");
});

test("deleteTenantUser removes the user", async () => {
  const user = await createTenantUser(context.tenant.id, {
    name: "Delete Me",
    email: "delete.me@example.com",
    password: "password123",
    role: "student",
  });
  await deleteTenantUser(context.tenant.id, user.id, "some-other-user");
  const row = await getDb().get("SELECT id FROM users WHERE id = ?", user.id);
  assert.equal(row, undefined);
});

test("listTenantUsers returns only users in the tenant", async () => {
  const users = await listTenantUsers(context.tenant.id);
  assert.ok(users.length >= 1);
  users.forEach((u) => assert.equal(u.tenantId, context.tenant.id));
});

// ---------------------------------------------------------------------------
// DATABASE CRUD
// ---------------------------------------------------------------------------

test("saveAssessment and getState expose the assessment to the teacher", async () => {
  const assessment = createAssessment("assessment-crud-1", context.approvedClass.id);
  await saveAssessment(context.teacherAuth, assessment);

  const state = await getState(context.teacherAuth);
  const found = state.assessments.find((a) => a.id === assessment.id);
  assert.ok(found);
  assert.equal(found.topic, assessment.topic);
});

test("updateAssessment changes status and persists", async () => {
  const assessment = createAssessment("assessment-crud-2", context.approvedClass.id);
  await saveAssessment(context.teacherAuth, assessment);

  await updateAssessment(context.teacherAuth, assessment.id, { status: "closed" });
  const state = await getState(context.teacherAuth);
  const found = state.assessments.find((a) => a.id === assessment.id);
  assert.equal(found.status, "closed");
});

test("deleteAssessment removes the assessment", async () => {
  const assessment = createAssessment("assessment-crud-3", context.approvedClass.id);
  await saveAssessment(context.teacherAuth, assessment);
  await deleteAssessment(context.teacherAuth, assessment.id);

  const state = await getState(context.teacherAuth);
  const found = state.assessments.find((a) => a.id === assessment.id);
  assert.equal(found, undefined);
});

test("saveSubmission persists a submission and clearData wipes tenant data", async () => {
  const assessment = createAssessment("assessment-crud-4", context.approvedClass.id);
  await saveAssessment(context.teacherAuth, assessment);
  await saveSubmission(context.tenant.id, context.student.id, createSubmission(assessment.id, "sub-clear-1"));

  const state = await getState(context.teacherAuth);
  assert.ok(state.submissions.some((s) => s.id === "sub-clear-1"));

  await clearData(context.tenant.id);
  const cleared = await getState(context.teacherAuth);
  assert.equal(cleared.submissions.length, 0);
});

// ---------------------------------------------------------------------------
// RATE LIMIT
// ---------------------------------------------------------------------------

test("assertRateLimit allows requests under the limit", () => {
  assert.doesNotThrow(() => assertRateLimit("rl-key-1", { limit: 3, windowMs: 60_000 }));
  assert.doesNotThrow(() => assertRateLimit("rl-key-1", { limit: 3, windowMs: 60_000 }));
  assert.doesNotThrow(() => assertRateLimit("rl-key-1", { limit: 3, windowMs: 60_000 }));
});

test("assertRateLimit throws 429 when the limit is exceeded", () => {
  assert.doesNotThrow(() => assertRateLimit("rl-key-2", { limit: 2, windowMs: 60_000 }));
  assert.doesNotThrow(() => assertRateLimit("rl-key-2", { limit: 2, windowMs: 60_000 }));
  assert.throws(() => assertRateLimit("rl-key-2", { limit: 2, windowMs: 60_000 }), { status: 429 });
});

test("assertRateLimit uses separate buckets per key", () => {
  assert.doesNotThrow(() => assertRateLimit("rl-key-a", { limit: 1, windowMs: 60_000 }));
  assert.doesNotThrow(() => assertRateLimit("rl-key-b", { limit: 1, windowMs: 60_000 }));
  assert.throws(() => assertRateLimit("rl-key-a", { limit: 1, windowMs: 60_000 }), { status: 429 });
});

// ---------------------------------------------------------------------------
// HTTP UTILS
// ---------------------------------------------------------------------------

test("parseCookies parses multiple cookies and decodes values", () => {
  const cookies = parseCookies({ headers: { cookie: "a=1; b=hello%20world; c=" } });
  assert.equal(cookies.a, "1");
  assert.equal(cookies.b, "hello world");
  assert.equal(cookies.c, "");
});

test("parseCookies returns empty object when no cookie header", () => {
  assert.deepEqual(parseCookies({ headers: {} }), {});
});

test("setCookie writes HttpOnly and SameSite attributes", () => {
  const res = { headers: {}, setHeader(name, value) { this.headers[name] = value; } };
  setCookie(res, "test_cookie", "value123", { maxAge: 3600, httpOnly: true, sameSite: "Lax" });
  const header = res.headers["Set-Cookie"];
  assert.match(header, /test_cookie=value123/);
  assert.match(header, /Max-Age=3600/);
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Lax/);
});

test("readJson parses the request body", async () => {
  const req = new EventEmitter();
  const promise = readJson(req);
  req.emit("data", Buffer.from('{"hello":"world"}'));
  req.emit("end");
  const body = await promise;
  assert.deepEqual(body, { hello: "world" });
});

test("readJson rejects invalid JSON", async () => {
  const req = new EventEmitter();
  const promise = readJson(req);
  req.emit("data", Buffer.from("{invalid"));
  req.emit("end");
  await assert.rejects(promise, /JSON tidak valid/);
});

test("sendJson writes JSON with the correct status code", () => {
  const res = {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers); },
    end(payload) { this.body = JSON.parse(payload); },
  };
  sendJson(res, 201, { ok: true });
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, { ok: true });
});

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

async function seedScenario() {
  const { tenant, user: admin } = await registerTenantUser({
    tenantName: "Services Test School",
    name: "Admin Services",
    email: "admin.services@example.com",
    password: "password123",
  });
  const teacher = await createTenantUser(tenant.id, {
    name: "Guru Services",
    email: "guru.services@example.com",
    password: "password123",
    role: "teacher",
  });
  const student = await createTenantUser(tenant.id, {
    name: "Siswa Services",
    email: "siswa.services@example.com",
    password: "password123",
    role: "student",
  });
  const teacherAuth = { tenant, user: teacher };

  const approvedClass = {
    id: "class-services-approved",
    name: "Kelas Services",
    joinCode: "SERVICES1",
    createdAt: new Date().toISOString(),
  };
  await createClass(tenant.id, teacher.id, approvedClass);

  await requestJoinClass(tenant.id, student.id, approvedClass.joinCode, {
    id: "member-services",
    requestedAt: new Date().toISOString(),
  });
  await approveMembership(tenant.id, teacher.id, "member-services");

  return { admin, tenant, teacher, student, teacherAuth, approvedClass };
}

function createAssessment(id, classId, overrides = {}) {
  return {
    id,
    classId,
    status: "published",
    topic: `Topik ${id}`,
    difficulty: "Menengah",
    outcomes: "Siswa mampu menjelaskan konsep utama.",
    rubric: "Akurasi, kelengkapan, dan kejelasan.",
    questions: [{ prompt: "Jelaskan konsep utama.", ideal: "Jawaban ideal." }],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function createSubmission(assessmentId, id) {
  return {
    id,
    assessmentId,
    studentName: "Siswa Services",
    assessmentTitle: "Assessment Services",
    finalScore: 80,
    questionScores: [],
    feedback: "Baik.",
    submittedAt: new Date().toISOString(),
  };
}
