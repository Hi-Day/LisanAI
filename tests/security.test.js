const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

process.env.TURSO_DATABASE_URL = `file:${path.join(os.tmpdir(), `oralai-test-${Date.now()}.db`)}`;
process.env.ENABLE_DEMO_SIMULATION = "false";

const authApi = require("../api/auth");
const databaseApi = require("../api/database");
const assessmentApi = require("../api/assessment");
const observabilityApi = require("../api/observability");
const {
  approveMembership,
  createClass,
  getDb,
  initDatabase,
  requestJoinClass,
  saveAssessment,
  saveSubmission,
  updateAssessment,
} = require("../server/database");
const {
  createTenantUser,
  registerTenantUser,
  createSession,
  SESSION_COOKIE,
  createCsrfToken,
} = require("../server/auth-service");
const { resetRateLimits } = require("../server/rate-limit");
const { ensureLegacyDemoAccounts } = require("../scripts/seed-accounts");

let context;

test.before(async () => {
  const dbPath = process.env.TURSO_DATABASE_URL.replace(/^file:/, "");
  fs.rmSync(dbPath, { force: true });
  await initDatabase();
  context = await seedTenantScenario();
});

test.beforeEach(() => {
  resetRateLimits();
});

test("database helpers accept array parameters passed as a single array", async () => {
  const db = getDb();
  const row = await db.get("SELECT ? AS first, ? AS second, ? AS third", ["alpha", "beta", "gamma"]);

  assert.deepEqual(row, { first: "alpha", second: "beta", third: "gamma" });
});

test("frontend bulk user creation imports the batch helper from the API module", () => {
  const source = fs.readFileSync(path.join(__dirname, "../public/js/main.js"), "utf8");

  assert.match(source, /import\s+\{[^}]*createUsersBatch[^}]*\}\s+from\s+["']\.\/api\.js["'];/);
});

test("tenant registration is exposed through a modal trigger from the auth landing view", () => {
  const html = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8");

  assert.match(html, /id="registerModal"/);
  assert.match(html, /id="openRegisterModalBtn"/);
  assert.match(html, /id="registerForm"/);
});

test("legacy demo accounts are created for compatibility with Vercel seed runs", async () => {
  await ensureLegacyDemoAccounts("password123");

  const db = getDb();
  const admin = await db.get("SELECT email, role FROM users WHERE email = ?", "admin@demo.com");
  const teacher = await db.get("SELECT email, role FROM users WHERE email = ?", "guru@demo.com");
  const student = await db.get("SELECT email, role FROM users WHERE email = ?", "budi@demo.com");

  assert.ok(admin);
  assert.equal(admin.role, "admin");
  assert.ok(teacher);
  assert.equal(teacher.role, "teacher");
  assert.ok(student);
  assert.equal(student.role, "student");
});

test("demo simulation endpoint is disabled by default", async () => {
  const response = await callHandler(authApi, { method: "GET", url: "/api/auth?action=simulation" });

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.error, "Action not found");
});

test("openrouter retries with the configured fallback model when the primary model fails", async () => {
  const { callOpenRouter } = require("../server/openrouter");
  const originalFetch = global.fetch;
  const originalPrimary = process.env.OPENROUTER_MODEL;
  const originalFallback = process.env.OPENROUTER_FALLBACK_MODEL;
  const originalApiKey = process.env.OPENROUTER_API_KEY;

  process.env.OPENROUTER_MODEL = "google/gemini-2.5-flash";
  process.env.OPENROUTER_FALLBACK_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";
  process.env.OPENROUTER_API_KEY = "test-key";

  const attempts = [];
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    attempts.push(body.model);

    if (body.model === "google/gemini-2.5-flash") {
      return {
        ok: false,
        json: async () => ({ error: { message: "primary model unavailable" } }),
      };
    }

    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"ok":true}' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    };
  };

  try {
    const result = await callOpenRouter(
      [{ role: "user", content: '{"jumlah_soal":1,"topik":"AI","learning_outcome":true}' }],
      "return valid JSON",
      { tenantId: "tenant-fallback", userId: "user-fallback", action: "generate-questions" }
    );

    assert.deepEqual(attempts, ["google/gemini-2.5-flash", "nvidia/nemotron-3-super-120b-a12b:free"]);
    assert.deepEqual(result, { ok: true });
  } finally {
    global.fetch = originalFetch;
    process.env.OPENROUTER_MODEL = originalPrimary;
    process.env.OPENROUTER_FALLBACK_MODEL = originalFallback;
    process.env.OPENROUTER_API_KEY = originalApiKey;
  }
});

test("login is rate limited after repeated failures", async () => {
  const payload = {
    action: "login",
    payload: { email: "siswa.security.test@example.com", password: "wrong-password" },
  };

  for (let index = 0; index < 5; index += 1) {
    const response = await callHandler(authApi, { method: "POST", url: "/api/auth", body: payload });
    assert.equal(response.statusCode, 401);
  }

  const limited = await callHandler(authApi, { method: "POST", url: "/api/auth", body: payload });
  assert.equal(limited.statusCode, 429);
});

test("valid session is restored and renewed when the page reloads", async () => {
  const session = await createSession(context.student.id);
  const response = await callHandler(authApi, {
    method: "GET",
    url: "/api/auth?action=me",
    headers: { cookie: `${SESSION_COOKIE}=${session.token}` },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.authenticated, true);
  assert.equal(response.body.user.id, context.student.id);
  assert.match(response.headers["set-cookie"], new RegExp(`^${SESSION_COOKIE}=`));
  assert.match(response.headers["set-cookie"], /Max-Age=604800/);
  assert.match(response.headers["set-cookie"], /HttpOnly/);
});

test("student cannot submit an assessment before class membership is approved", async () => {
  const { tenant, student, pendingAssessment } = context;

  await assert.rejects(
    () => saveSubmission(tenant.id, student.id, createSubmission(pendingAssessment.id, "sub-pending")),
    { status: 403 }
  );
});

test("student cannot submit a closed assessment", async () => {
  const { tenant, student, closedAssessment } = context;

  await assert.rejects(
    () => saveSubmission(tenant.id, student.id, createSubmission(closedAssessment.id, "sub-closed")),
    { status: 403 }
  );
});

test("student cannot submit the same assessment twice unless retakes are enabled", async () => {
  const { tenant, student, publishedAssessment, retakeAssessment } = context;

  await saveSubmission(tenant.id, student.id, createSubmission(publishedAssessment.id, "sub-first"));
  await assert.rejects(
    () => saveSubmission(tenant.id, student.id, createSubmission(publishedAssessment.id, "sub-second")),
    { status: 409 }
  );

  await saveSubmission(tenant.id, student.id, createSubmission(retakeAssessment.id, "sub-retake-1"));
  await saveSubmission(tenant.id, student.id, createSubmission(retakeAssessment.id, "sub-retake-2"));
});

test("student-facing state API omits ideal answers from assessment questions", async () => {
  const { student, tenant, publishedAssessment } = context;
  const session = await createSession(student.id);
  const headers = { cookie: `${SESSION_COOKIE}=${session.token}` };

  const response = await callHandler(databaseApi, {
    method: "GET",
    url: "/api/database?action=state",
    headers,
  });

  assert.equal(response.statusCode, 200);
  const assessment = response.body.assessments.find((item) => item.id === publishedAssessment.id);
  assert.ok(assessment);
  assert.ok(Array.isArray(assessment.questions));
  assert.equal(assessment.questions[0].prompt, "Jelaskan konsep utama.");
  assert.equal(assessment.questions[0].ideal, undefined);
});

test("API endpoints require valid CSRF token for POST requests", async () => {
  const { student, tenant, retakeAssessment } = context;
  const session = await createSession(student.id);
  const headers = { cookie: `${SESSION_COOKIE}=${session.token}` };

  // 1. Database API: No CSRF header should fail with 403
  const resDbNoCsrf = await callHandler(databaseApi, {
    method: "POST",
    url: "/api/database",
    body: { action: "save-submission", payload: createSubmission(retakeAssessment.id, "sub-csrf-none") },
    headers
  });
  assert.equal(resDbNoCsrf.statusCode, 403);
  assert.equal(resDbNoCsrf.body.error, "CSRF token tidak valid");

  // 2. Assessment API: No CSRF header should fail with 403
  const resAssNoCsrf = await callHandler(assessmentApi, {
    method: "POST",
    url: "/api/assessment",
    body: { action: "evaluate", payload: { assessment: retakeAssessment, answers: ["Jawaban"], studentName: student.name } },
    headers
  });
  assert.equal(resAssNoCsrf.statusCode, 403);
  assert.equal(resAssNoCsrf.body.error, "CSRF token tidak valid");

  // 3. Database API: Valid CSRF header should succeed (returns 201)
  const authContext = { sessionId: session.sessionId, tenant, user: student };
  const csrfToken = createCsrfToken(authContext);
  const resDbValidCsrf = await callHandler(databaseApi, {
    method: "POST",
    url: "/api/database",
    body: { action: "save-submission", payload: createSubmission(retakeAssessment.id, "sub-csrf-ok") },
    headers: { ...headers, "x-csrf-token": csrfToken }
  });
  assert.equal(resDbValidCsrf.statusCode, 201);
});

test("assessment evaluate endpoint enforces student authorization checks", async () => {
  const { student, tenant, pendingAssessment } = context;
  const session = await createSession(student.id);
  const headers = { cookie: `${SESSION_COOKIE}=${session.token}` };
  const authContext = { sessionId: session.sessionId, tenant, user: student };
  const csrfToken = createCsrfToken(authContext);

  // Student is not approved in pending class, evaluate should fail with 403
  const resEvaluate = await callHandler(assessmentApi, {
    method: "POST",
    url: "/api/assessment",
    body: { action: "evaluate", payload: { assessment: pendingAssessment, answers: ["Jawaban"], studentName: student.name } },
    headers: { ...headers, "x-csrf-token": csrfToken }
  });
  assert.equal(resEvaluate.statusCode, 403);
  assert.equal(resEvaluate.body.error, "Siswa belum disetujui di kelas assessment ini");
});

test("teacher can bulk create students and add them to their class", async () => {
  const { tenant, teacher } = context;
  const teacherSession = await createSession(teacher.id);
  const headers = { cookie: `${SESSION_COOKIE}=${teacherSession.token}` };
  const authContext = { sessionId: teacherSession.sessionId, tenant, user: teacher };
  const csrfToken = createCsrfToken(authContext);

  const response = await callHandler(databaseApi, {
    method: "POST",
    url: "/api/database",
    body: {
      action: "create-students-batch",
      payload: {
        classId: "class-approved",
        users: [
          { name: "CSV Student 1", email: "csv.student1@example.com", password: "password123" },
          { name: "CSV Student 2", email: "csv.student2@example.com", password: "password123" },
        ],
      },
    },
    headers: { ...headers, "x-csrf-token": csrfToken },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.added.length, 2);
  assert.ok(Array.isArray(response.body.errors));
  assert.equal(response.body.errors.length, 0);

  const db = getDb();
  const student1 = await db.get("SELECT id, email FROM users WHERE email = ?", "csv.student1@example.com");
  assert.ok(student1);
  const membership = await db.get(
    "SELECT id FROM class_memberships WHERE student_id = ? AND class_id = ?",
    student1.id,
    "class-approved"
  );
  assert.ok(membership);
});

test("teacher can correct submissions in their class but not in other classes", async () => {
  const { tenant, student, teacher, publishedAssessment } = context;
  const teacherAuth = { tenant, user: teacher };

  // Create a specific assessment for the correction test so it doesn't conflict with existing submissions
  const correctionAssessment = createAssessment("assessment-correction", publishedAssessment.classId);
  await saveAssessment(teacherAuth, correctionAssessment);

  // 1. Create a submission by the student for the correction assessment
  const submissionId = "sub-to-correct-1";
  await saveSubmission(tenant.id, student.id, createSubmission(correctionAssessment.id, submissionId));

  // Create another teacher and another class/assessment/submission
  const otherTeacher = await createTenantUser(tenant.id, {
    name: "Guru Lain",
    email: "guru.lain.test@example.com",
    password: "password123",
    role: "teacher",
  });
  const otherClass = {
    id: "class-other",
    name: "Kelas Lain",
    joinCode: "OTHERCLASS1",
    createdAt: new Date().toISOString(),
  };
  await createClass(tenant.id, otherTeacher.id, otherClass);
  const otherAssessment = createAssessment("assessment-other", otherClass.id);
  const otherTeacherAuth = { tenant, user: otherTeacher };
  await saveAssessment(otherTeacherAuth, otherAssessment);
  
  const otherSubmissionId = "sub-to-correct-other";
  await requestJoinClass(tenant.id, student.id, otherClass.joinCode, {
    id: "member-other",
    requestedAt: new Date().toISOString(),
  });
  await approveMembership(tenant.id, otherTeacher.id, "member-other");
  await saveSubmission(tenant.id, student.id, createSubmission(otherAssessment.id, otherSubmissionId));

  // 2. Now let's try to update (correct) submissionId as the teacher (who teaches correctionAssessment's class).
  const teacherSession = await createSession(teacher.id);
  const teacherHeaders = { cookie: `${SESSION_COOKIE}=${teacherSession.token}` };
  const teacherAuthContext = { sessionId: teacherSession.sessionId, tenant, user: teacher };
  const teacherCsrfToken = createCsrfToken(teacherAuthContext);

  const correctPayload = createSubmission(correctionAssessment.id, submissionId);
  correctPayload.finalScore = 95; // change score

  const resCorrectionSuccess = await callHandler(databaseApi, {
    method: "POST",
    url: "/api/database",
    body: { action: "save-submission", payload: correctPayload },
    headers: { ...teacherHeaders, "x-csrf-token": teacherCsrfToken }
  });
  assert.equal(resCorrectionSuccess.statusCode, 200);
  assert.equal(resCorrectionSuccess.body.submission.finalScore, 95);

  // 3. Now let's try to update otherSubmissionId (which is for otherTeacher's class) as the teacher.
  const incorrectPayload = createSubmission(otherAssessment.id, otherSubmissionId);
  incorrectPayload.finalScore = 90;

  const resCorrectionForbidden = await callHandler(databaseApi, {
    method: "POST",
    url: "/api/database",
    body: { action: "save-submission", payload: incorrectPayload },
    headers: { ...teacherHeaders, "x-csrf-token": teacherCsrfToken }
  });
  assert.equal(resCorrectionForbidden.statusCode, 403);
  assert.match(resCorrectionForbidden.body.error, /Guru hanya boleh mengoreksi kelas miliknya/);
});

test("observability API endpoints enforce proper role-based authorization", async () => {
  const { admin, student } = context;

  // 1. Unauthenticated request - should return 401
  const resUnauth = await callHandler(observabilityApi, {
    method: "GET",
    url: "/api/observability",
  });
  assert.equal(resUnauth.statusCode, 401);

  // 2. Student request - should return 403
  const studentSession = await createSession(student.id);
  const studentHeaders = { cookie: `${SESSION_COOKIE}=${studentSession.token}` };
  const resStudent = await callHandler(observabilityApi, {
    method: "GET",
    url: "/api/observability",
    headers: studentHeaders,
  });
  assert.equal(resStudent.statusCode, 403);

  // 3. Admin request - should return 200 with metrics, system health, and logs
  const adminSession = await createSession(admin.id);
  const adminHeaders = { cookie: `${SESSION_COOKIE}=${adminSession.token}` };
  const resAdmin = await callHandler(observabilityApi, {
    method: "GET",
    url: "/api/observability",
    headers: adminHeaders,
  });
  assert.equal(resAdmin.statusCode, 200);
  assert.ok(resAdmin.body.metrics);
  assert.ok(resAdmin.body.system);
  assert.ok(Array.isArray(resAdmin.body.logs));
});




async function seedTenantScenario() {
  const { tenant, user: admin } = await registerTenantUser({
    tenantName: "Security Test School",
    name: "Admin Test",
    email: "admin.security.test@example.com",
    password: "password123",
  });
  const teacher = await createTenantUser(tenant.id, {
    name: "Guru Test",
    email: "guru.security.test@example.com",
    password: "password123",
    role: "teacher",
  });
  const student = await createTenantUser(tenant.id, {
    name: "Siswa Test",
    email: "siswa.security.test@example.com",
    password: "password123",
    role: "student",
  });
  const pendingStudent = await createTenantUser(tenant.id, {
    name: "Siswa Pending",
    email: "pending.security.test@example.com",
    password: "password123",
    role: "student",
  });
  const teacherAuth = { tenant, user: teacher };

  const approvedClass = {
    id: "class-approved",
    name: "Kelas Approved",
    joinCode: "APPROVED1",
    createdAt: new Date().toISOString(),
  };
  const pendingClass = {
    id: "class-pending",
    name: "Kelas Pending",
    joinCode: "PENDING1",
    createdAt: new Date().toISOString(),
  };
  await createClass(tenant.id, teacher.id, approvedClass);
  await createClass(tenant.id, teacher.id, pendingClass);

  await requestJoinClass(tenant.id, student.id, approvedClass.joinCode, {
    id: "member-approved",
    requestedAt: new Date().toISOString(),
  });
  await approveMembership(tenant.id, teacher.id, "member-approved");

  await requestJoinClass(tenant.id, pendingStudent.id, pendingClass.joinCode, {
    id: "member-pending",
    requestedAt: new Date().toISOString(),
  });

  const publishedAssessment = createAssessment("assessment-published", approvedClass.id);
  const closedAssessment = createAssessment("assessment-closed", approvedClass.id, { status: "closed" });
  const retakeAssessment = createAssessment("assessment-retake", approvedClass.id, { allowRetakes: true });
  const pendingAssessment = createAssessment("assessment-pending", pendingClass.id);

  await saveAssessment(teacherAuth, publishedAssessment);
  await saveAssessment(teacherAuth, closedAssessment);
  await saveAssessment(teacherAuth, retakeAssessment);
  await saveAssessment(teacherAuth, pendingAssessment);

  await updateAssessment(teacherAuth, closedAssessment.id, { status: "closed" });

  return {
    admin,
    tenant,
    teacher,
    student,
    pendingStudent,
    publishedAssessment,
    closedAssessment,
    pendingAssessment,
    retakeAssessment,
  };
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
    studentName: "Siswa Test",
    assessmentTitle: "Assessment Test",
    finalScore: 80,
    questionScores: [],
    feedback: "Baik.",
    submittedAt: new Date().toISOString(),
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
