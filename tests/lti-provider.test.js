const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const dbPath = path.join(os.tmpdir(), `oralai-lti-provider-${Date.now()}.db`);
process.env.TURSO_DATABASE_URL = `file:${dbPath}`;
process.env.ENABLE_DEMO_SIMULATION = "false";

const LAUNCH_URL = "https://tool.example.edu/api/lti";
const CONSUMER_KEY = "binusmaya-test";
const CONSUMER_SECRET = "test-shared-secret";
const OUTCOME_URL = "https://lms.example.edu/outcomes";

const { initDatabase, getDb, getState } = require("../server/database");
const { registerTenantUser, createTenantUser } = require("../server/auth-service");
const { calculateOAuthSignature, processLaunch, processMapping } = require("../server/lti");
const { saveSubmission } = require("../server/database");
const { validateScores } = require("../server/application/score-validation-service");
const { pendingRelease } = require("../server/score-release");

let ctx;
let nonce = 0;

function fakeRes() {
  return {
    status: null, headers: {}, body: "",
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    getHeader(name) { return this.headers[name.toLowerCase()]; },
    writeHead(status, headers = {}) { this.status = status; for (const [k, v] of Object.entries(headers)) this.headers[k.toLowerCase()] = v; return this; },
    end(body = "") { this.body = String(body); return this; },
  };
}

async function launch(extra) {
  const parameters = {
    lti_message_type: "basic-lti-launch-request",
    lti_version: "LTI-1p0",
    oauth_consumer_key: CONSUMER_KEY,
    oauth_nonce: `nonce-${Date.now()}-${nonce++}`,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: "1.0",
    context_id: "course-1",
    resource_link_id: "content-1",
    ...extra,
  };
  parameters.oauth_signature = calculateOAuthSignature({ url: LAUNCH_URL, parameters, consumerSecret: CONSUMER_SECRET });
  const res = fakeRes();
  await processLaunch(parameters, LAUNCH_URL, { headers: { "x-forwarded-proto": "https" }, socket: {} }, res);
  return res;
}

test.before(async () => {
  fs.rmSync(dbPath, { force: true });
  await initDatabase();
  const { tenant, user: admin } = await registerTenantUser({ tenantName: "BINUS", name: "Admin", email: "admin.lti@example.edu", password: "password123" });
  const teacher = await createTenantUser(tenant.id, { name: "Dosen", email: "dosen.lti@example.edu", password: "password123", role: "teacher" });
  const other = await registerTenantUser({ tenantName: "Other", name: "Other", email: "other.lti@example.edu", password: "password123" });
  const db = getDb();
  const now = new Date().toISOString();
  await db.run("INSERT INTO classes (id, tenant_id, teacher_id, name, join_code, created_at) VALUES (?, ?, ?, ?, ?, ?)", "class-lti", tenant.id, teacher.id, "LB01", "LTI001", now);
  const assessment = { id: "asmt-lti", topic: "Presentasi Lisan", difficulty: "Sedang", questions: [{ prompt: "Jelaskan" }], classId: "class-lti" };
  await db.run(
    "INSERT INTO assessments (id, tenant_id, class_id, teacher_id, status, topic, difficulty, payload, created_at) VALUES (?, ?, ?, ?, 'published', ?, ?, ?, ?)",
    assessment.id, tenant.id, "class-lti", teacher.id, assessment.topic, assessment.difficulty, JSON.stringify(assessment), now,
  );
  await db.run("INSERT INTO assessment_classes (tenant_id, assessment_id, class_id, status, assigned_at) VALUES (?, ?, ?, 'published', ?)", tenant.id, assessment.id, "class-lti", now);

  process.env.LTI_CONSUMERS_JSON = JSON.stringify({ [CONSUMER_KEY]: CONSUMER_SECRET });
  process.env.LTI_TENANT_ID = tenant.id;
  process.env.LTI_OUTCOME_HOSTS = "lms.example.edu";
  process.env.LTI_PUBLIC_ORIGIN = "https://tool.example.edu";
  ctx = { tenant, admin, teacher, otherTenant: other.tenant, assessment };
});

test.after(() => {
  for (const key of ["LTI_CONSUMERS_JSON", "LTI_TENANT_ID", "LTI_OUTCOME_HOSTS", "LTI_PUBLIC_ORIGIN"]) delete process.env[key];
  try { fs.rmSync(dbPath, { force: true }); } catch {} // Windows keeps the open libsql file locked (EBUSY)
});

test("student launch on an unmapped link explains that the lecturer must connect it", async () => {
  const res = await launch({ user_id: "maya-student-0", roles: "Learner", lis_person_contact_email_primary: "early.student@example.edu" });
  assert.equal(res.status, 409);
  assert.match(res.body, /belum terhubung/i);
});

test("instructor launch links the existing lecturer account by email and offers the mapping form", async () => {
  const res = await launch({ user_id: "maya-lecturer-1", roles: "Instructor", lis_person_contact_email_primary: "Dosen.LTI@example.edu" });
  assert.equal(res.status, 200);
  assert.match(res.body, /Hubungkan materi/);
  assert.match(res.body, /Presentasi Lisan/);
  const identity = await getDb().get("SELECT user_id FROM lti_identities WHERE lti_user_id = ?", "maya-lecturer-1");
  assert.equal(identity.user_id, ctx.teacher.id, "must reuse the existing account, not create a duplicate");

  const form = Object.fromEntries([...res.body.matchAll(/name="(\w+)" value="([^"]*)"/g)].map((m) => [m[1], m[2].replace(/&amp;/g, "&")]));
  form.target = "asmt-lti|class-lti";
  const auth = { tenant: ctx.tenant, user: { id: ctx.teacher.id, role: "teacher" } };
  await assert.rejects(processMapping({ ...form, token: "forged" }, auth), /Token pemetaan/);
  const page = await processMapping(form, auth);
  assert.match(page, /Materi terhubung/);
  const mapping = await getDb().get("SELECT assessment_id, class_id FROM lti_resource_links WHERE resource_link_id = ?", "content-1");
  assert.deepEqual({ ...mapping }, { assessment_id: "asmt-lti", class_id: "class-lti" });
});

test("email registered in another tenant is refused instead of silently linked", async () => {
  await createTenantUser(ctx.otherTenant.id, { name: "Luar", email: "luar@example.edu", password: "password123", role: "student" });
  const res = await launch({ user_id: "maya-outsider", roles: "Learner", lis_person_contact_email_primary: "luar@example.edu" }).catch((error) => error);
  assert.equal(res.status, 409);
});

test("learner launch on a mapped link creates the account, enrolls the class, binds outcomes, and opens the assessment", async () => {
  const res = await launch({
    user_id: "maya-student-1", roles: "Learner", lis_person_name_full: "Mahasiswa Satu",
    lis_person_contact_email_primary: "mhs1@example.edu",
    lis_outcome_service_url: OUTCOME_URL, lis_result_sourcedid: "sourced-1",
  });
  assert.equal(res.status, 303);
  assert.equal(res.headers.location, "https://tool.example.edu/?lti_assessment=asmt-lti#studentView");
  assert.match(String(res.headers["set-cookie"]), /SameSite=None; Secure/);

  const student = await getDb().get("SELECT id, role FROM users WHERE email = ?", "mhs1@example.edu");
  assert.equal(student.role, "student");
  const membership = await getDb().get("SELECT status FROM class_memberships WHERE class_id = ? AND student_id = ?", "class-lti", student.id);
  assert.equal(membership.status, "approved");
  const binding = await getDb().get("SELECT assessment_id, sourced_id FROM lti_outcome_bindings WHERE user_id = ?", student.id);
  assert.deepEqual({ ...binding }, { assessment_id: "asmt-lti", sourced_id: "sourced-1" });
  ctx.student = student;
});

test("score stays hidden from the student until the lecturer validates it, then is sent to the LMS", async () => {
  const submission = {
    id: "sub-lti-1", assessmentId: "asmt-lti", assessmentTitle: "Presentasi Lisan", classId: "class-lti",
    studentName: "Mahasiswa Satu", submittedAt: new Date().toISOString(), status: "NEEDS_REVIEW",
    finalScore: 82, feedback: "Struktur jelas. Skor akhir 82 dari 100.",
    questionScores: [{ question: "Jelaskan", answer: "...", score: 82, strengths: ["Runtut"], gaps: ["Contoh kurang"] }],
    criteria: [{ criterionId: "c1", score: 82 }], scoreRelease: pendingRelease(),
  };
  await saveSubmission(ctx.tenant.id, ctx.student.id, submission, true);
  const studentAuth = { tenant: ctx.tenant, user: { id: ctx.student.id, role: "student" } };

  const hidden = (await getState(studentAuth)).submissions.find((item) => item.id === "sub-lti-1");
  assert.equal(hidden.finalScore, undefined);
  assert.equal(hidden.criteria, undefined);
  assert.equal(hidden.questionScores[0].score, undefined);
  assert.deepEqual(hidden.questionScores[0].strengths, ["Runtut"]);
  assert.doesNotMatch(hidden.feedback, /82/);
  assert.equal(hidden.scoreRelease.status, "pending");
  const competency = await getDb().get("SELECT COUNT(*) AS n FROM student_competency_state WHERE student_id = ?", ctx.student.id);
  assert.equal(competency.n, 0, "unvalidated scores must not feed competency projections");

  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, init) => {
    calls.push({ url, body: init.body, authorization: init.headers.authorization });
    return { ok: true, status: 200, text: async () => "<imsx_codeMajor>success</imsx_codeMajor>" };
  };
  try {
    const studentAttempt = await validateScores(studentAuth, ["sub-lti-1"]).catch((error) => error);
    assert.equal(studentAttempt.status, 403);

    const teacherAuth = { tenant: ctx.tenant, user: { id: ctx.teacher.id, role: "teacher" } };
    const result = await validateScores(teacherAuth, ["sub-lti-1"]);
    assert.deepEqual(result.validated, ["sub-lti-1"]);
    assert.equal(result.queuedForLms, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, OUTCOME_URL);
    assert.match(calls[0].body, /<sourcedId>sourced-1<\/sourcedId>/);
    assert.match(calls[0].body, /<textString>0\.8200<\/textString>/);
    assert.match(calls[0].authorization, /^OAuth /);

    const again = await validateScores(teacherAuth, ["sub-lti-1"]);
    assert.deepEqual(again.alreadyValidated, ["sub-lti-1"]);
    assert.equal(calls.length, 1, "re-validation must not resend an unchanged score");
  } finally {
    global.fetch = originalFetch;
  }

  const visible = (await getState(studentAuth)).submissions.find((item) => item.id === "sub-lti-1");
  assert.equal(visible.finalScore, 82);
  assert.equal(visible.status, "EVALUATED");
  assert.equal(visible.scoreRelease.status, "released");
  const outbox = await getDb().get("SELECT status FROM lti_outcome_outbox WHERE submission_id = ?", "sub-lti-1");
  assert.equal(outbox.status, "sent");
});
