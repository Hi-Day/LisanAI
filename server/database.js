const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { createClient } = require("@libsql/client");
const { ROOT } = require("./config");

const DATA_DIR = path.join(ROOT, "data");

let db;
let libsqlClient;

function normalizeParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0];
  }
  return params;
}

async function initDatabase() {
  if (process.env.TURSO_DATABASE_URL.startsWith("file:")) {
    if (process.env.VERCEL) {
      console.error("CRITICAL ERROR: Anda menjalankan Vercel tetapi belum mengatur TURSO_DATABASE_URL di Environment Variables!");
      throw new Error("Missing Turso configuration on Vercel");
    }
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  libsqlClient = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  db = {
    async all(sql, ...params) {
      const rs = await libsqlClient.execute({ sql, args: normalizeParams(params) });
      return rs.rows;
    },
    async get(sql, ...params) {
      const rs = await libsqlClient.execute({ sql, args: normalizeParams(params) });
      return rs.rows[0];
    },
    async run(sql, ...params) {
      await libsqlClient.execute({ sql: "PRAGMA foreign_keys = ON", args: [] });
      const rs = await libsqlClient.execute({ sql, args: normalizeParams(params) });
      return { changes: rs.rowsAffected, lastInsertRowid: rs.lastInsertRowid };
    },
    async exec(sql) {
      await libsqlClient.execute({ sql: "PRAGMA foreign_keys = ON", args: [] });
      await libsqlClient.executeMultiple(sql);
    }
  };

  await db.exec("PRAGMA foreign_keys = ON");
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
  await runFileMigrations();
  await ensureColumn("assessments", "tenant_id", "TEXT");
  await ensureColumn("assessments", "class_id", "TEXT");
  await ensureColumn("assessments", "teacher_id", "TEXT");
  await ensureColumn("assessments", "status", "TEXT DEFAULT 'published'");
  await ensureColumn("submissions", "tenant_id", "TEXT");
  await ensureColumn("submissions", "user_id", "TEXT");
  await ensureColumn("evaluation_runs", "input_hash", "TEXT");
  await ensureColumn("evaluation_runs", "rubric_hash", "TEXT");
  await ensureColumn("evaluation_runs", "prompt_hash", "TEXT");
  await ensureColumn("evaluation_runs", "config_hash", "TEXT");
  await ensureColumn("evaluation_runs", "published", "INTEGER");
  await ensureColumn("evaluation_runs", "requires_human_review", "INTEGER");
  // P1 (migration 014): context versioning, risk/policy, cost attribution.
  await ensureColumn("evaluation_runs", "context_hash", "TEXT");
  await ensureColumn("evaluation_runs", "context_version", "TEXT");
  await ensureColumn("evaluation_runs", "risk_score", "REAL");
  await ensureColumn("evaluation_runs", "risk_level", "TEXT");
  await ensureColumn("evaluation_runs", "policy_applied", "TEXT");
  await ensureColumn("ai_logs", "run_id", "TEXT");
}

function getDb() {
  if (!db) throw new Error("Database belum siap");
  return db;
}

async function ensureColumn(table, column, type) {
  const columns = await db.all(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

async function recordMigration(version, name) {
  await db.run(
    "INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
    version,
    name,
    new Date().toISOString()
  );
}

async function runFileMigrations() {
  const migrationsDir = path.join(__dirname, "migrations");
  if (!fs.existsSync(migrationsDir)) return;
  const files = fs.readdirSync(migrationsDir)
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort();

  for (const file of files) {
    const version = Number(file.split("_")[0]);
    const existing = await db.get("SELECT version FROM schema_migrations WHERE version = ?", version);
    if (existing) continue;
    await db.exec(fs.readFileSync(path.join(migrationsDir, file), "utf8"));
    await recordMigration(version, file.replace(/\.sql$/, ""));
  }
}

async function getState(auth) {
  const database = getDb();
  const assessments = await getVisibleAssessments(database, auth);
  const submissions = await getVisibleSubmissions(database, auth);
  const classes = await getVisibleClasses(database, auth);
  const memberships = await getVisibleMemberships(database, auth);
  const studentView = auth.user.role === "student";

  return {
    assessments: assessments.map((row) => sanitizeAssessmentForRole(JSON.parse(row.payload), studentView)),
    submissions: submissions.map((row) => stripSubmissionAudio(JSON.parse(row.payload))),
    classes,
    memberships,
  };
}

/**
 * Lightweight list shape: drop base64 audio blobs from questionScores so the
 * state response stays small as recordings accumulate. The full payload
 * (with audio) is still served on demand via getSubmissionDetail.
 */
function stripSubmissionAudio(submission) {
  if (!submission || typeof submission !== "object") return submission;
  const { audio: rootAudio, ...rest } = submission;
  const out = { ...rest };
  if (rootAudio !== undefined) out.hasAudio = true;
  if (Array.isArray(out.questionScores)) {
    out.questionScores = out.questionScores.map((item) => {
      if (!item || item.audio === undefined) return item;
      const { audio, ...itemRest } = item;
      void audio;
      return { ...itemRest, hasAudio: true };
    });
  }
  return out;
}

/**
 * Full submission payload (including audio) for the detail/result views.
 * Role-scoped: students only their own, teachers only their own classes.
 */
async function getSubmissionDetail(auth, submissionId) {
  const database = getDb();
  const row = await database.get(
    "SELECT * FROM submissions WHERE id = ? AND tenant_id = ?",
    submissionId,
    auth.tenant.id
  );
  if (!row) throw Object.assign(new Error("Submission tidak ditemukan"), { status: 404 });
  if (auth.user.role === "student") {
    if (!row.user_id || row.user_id !== auth.user.id) {
      throw Object.assign(new Error("Siswa hanya dapat buka submission miliknya"), { status: 403 });
    }
  } else if (auth.user.role === "teacher") {
    const classroom = row.assessment_id
      ? await database.get(
          `SELECT teacher_id FROM classes
           WHERE id = (SELECT class_id FROM assessments WHERE id = ? AND tenant_id = ?)`,
          row.assessment_id,
          auth.tenant.id
        )
      : null;
    if (!classroom || classroom.teacher_id !== auth.user.id) {
      throw Object.assign(new Error("Guru hanya bisa buka submission miliknya"), { status: 403 });
    }
  }
  return JSON.parse(row.payload);
}

function sanitizeAssessmentForRole(assessment, isStudentView) {
  if (!isStudentView || !Array.isArray(assessment.questions)) return assessment;

  return {
    ...assessment,
    questions: assessment.questions.map((question) => {
      const { ideal, ...rest } = question || {};
      return rest;
    }),
  };
}

async function getVisibleAssessments(database, auth) {
  if (auth.user.role === "student") {
    return database.all(
      `SELECT assessments.payload
       FROM assessments
       JOIN class_memberships ON class_memberships.class_id = assessments.class_id
       WHERE assessments.tenant_id = ?
         AND class_memberships.student_id = ?
         AND class_memberships.status = 'approved'
         AND COALESCE(assessments.status, 'published') = 'published'
       ORDER BY assessments.created_at DESC`,
      auth.tenant.id,
      auth.user.id
    );
  }

  if (auth.user.role === "teacher") {
    return database.all(
      "SELECT payload FROM assessments WHERE tenant_id = ? AND teacher_id = ? ORDER BY created_at DESC",
      auth.tenant.id,
      auth.user.id
    );
  }

  return database.all(
    "SELECT payload FROM assessments WHERE tenant_id = ? ORDER BY created_at DESC",
    auth.tenant.id
  );
}

async function getVisibleSubmissions(database, auth) {
  if (auth.user.role === "student") {
    return database.all(
      "SELECT payload FROM submissions WHERE tenant_id = ? AND user_id = ? ORDER BY submitted_at ASC",
      auth.tenant.id,
      auth.user.id
    );
  }

  if (auth.user.role === "teacher") {
    // Guru hanya melihat siswa di kelasnya sendiri (bukan seluruh tenant).
    return database.all(
      `SELECT s.payload
       FROM submissions s
       JOIN assessments a ON a.id = s.assessment_id
       WHERE s.tenant_id = ? AND a.tenant_id = ? AND a.teacher_id = ?
       ORDER BY s.submitted_at ASC`,
      auth.tenant.id,
      auth.tenant.id,
      auth.user.id
    );
  }

  return database.all(
    "SELECT payload FROM submissions WHERE tenant_id = ? ORDER BY submitted_at ASC",
    auth.tenant.id
  );
}

async function getVisibleClasses(database, auth) {
  if (auth.user.role === "student") {
    return database.all(
      `SELECT classes.*, class_memberships.status
       FROM class_memberships
       JOIN classes ON classes.id = class_memberships.class_id
       WHERE class_memberships.tenant_id = ? AND class_memberships.student_id = ?
       ORDER BY classes.created_at DESC`,
      auth.tenant.id,
      auth.user.id
    );
  }

  if (auth.user.role === "teacher") {
    return database.all(
      "SELECT *, 'teacher' AS status FROM classes WHERE tenant_id = ? AND teacher_id = ? ORDER BY created_at DESC",
      auth.tenant.id,
      auth.user.id
    );
  }

  return database.all(
    "SELECT *, 'admin' AS status FROM classes WHERE tenant_id = ? ORDER BY created_at DESC",
    auth.tenant.id
  );
}

async function getVisibleMemberships(database, auth) {
  if (auth.user.role !== "teacher") return [];
  return database.all(
    `SELECT class_memberships.*, users.name AS student_name, users.email AS student_email, classes.name AS class_name
     FROM class_memberships
     JOIN users ON users.id = class_memberships.student_id
     JOIN classes ON classes.id = class_memberships.class_id
     WHERE class_memberships.tenant_id = ? AND classes.teacher_id = ?
     ORDER BY class_memberships.requested_at DESC`,
    auth.tenant.id,
    auth.user.id
  );
}

async function saveAssessment(auth, assessment) {
  await assertCanWriteAssessment(auth, assessment);
  await getDb().run(
    `INSERT OR REPLACE INTO assessments (id, tenant_id, class_id, teacher_id, status, topic, difficulty, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    assessment.id,
    auth.tenant.id,
    assessment.classId,
    auth.user.id,
    assessment.status || "published",
    assessment.topic,
    assessment.difficulty,
    JSON.stringify(assessment),
    assessment.createdAt
  );
  return assessment;
}

async function updateAssessment(auth, assessmentId, patch) {
  const existing = await getWritableAssessment(auth, assessmentId);
  const payload = JSON.parse(existing.payload);
  const next = {
    ...payload,
    ...patch,
    id: payload.id,
    // Fall back to the DB row's class_id when the payload predates classId
    classId: patch.classId || payload.classId || existing.class_id,
    updatedAt: new Date().toISOString(),
  };
  await assertCanWriteAssessment(auth, next);
  await getDb().run(
    `UPDATE assessments
     SET class_id = ?, status = ?, topic = ?, difficulty = ?, payload = ?
     WHERE id = ? AND tenant_id = ?`,
    next.classId,
    next.status || "published",
    next.topic,
    next.difficulty,
    JSON.stringify(next),
    assessmentId,
    auth.tenant.id
  );
  return next;
}

async function deleteAssessment(auth, assessmentId) {
  await getWritableAssessment(auth, assessmentId);
  await getDb().run("DELETE FROM assessments WHERE id = ? AND tenant_id = ?", assessmentId, auth.tenant.id);
}

async function getWritableAssessment(auth, assessmentId) {
  const assessment = await getDb().get("SELECT * FROM assessments WHERE id = ? AND tenant_id = ?", assessmentId, auth.tenant.id);
  if (!assessment) throw Object.assign(new Error("Assessment tidak ditemukan"), { status: 404 });
  if (auth.user.role === "teacher" && assessment.teacher_id !== auth.user.id) {
    throw Object.assign(new Error("Guru hanya boleh mengubah assessment miliknya"), { status: 403 });
  }
  return assessment;
}

async function assertCanWriteAssessment(auth, assessment) {
  if (!assessment.classId) throw Object.assign(new Error("Assessment wajib punya kelas tujuan"), { status: 400 });
  const classroom = await getDb().get(
    "SELECT id, teacher_id FROM classes WHERE id = ? AND tenant_id = ?",
    assessment.classId,
    auth.tenant.id
  );
  if (!classroom) throw Object.assign(new Error("Kelas tidak ditemukan"), { status: 404 });
  if (auth.user.role === "teacher" && classroom.teacher_id !== auth.user.id) {
    throw Object.assign(new Error("Guru hanya boleh membuat assessment untuk kelasnya sendiri"), { status: 403 });
  }
}

async function createClass(tenantId, teacherId, classroom) {
  await getDb().run(
    `INSERT INTO classes (id, tenant_id, teacher_id, name, join_code, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    classroom.id,
    tenantId,
    teacherId,
    classroom.name,
    classroom.joinCode,
    classroom.createdAt
  );
  return classroom;
}

async function updateClass(auth, classId, patch) {
  const classroom = await getWritableClass(auth, classId);
  const name = String(patch.name || classroom.name).trim();
  if (!name) throw Object.assign(new Error("Nama kelas wajib diisi"), { status: 400 });
  await getDb().run("UPDATE classes SET name = ? WHERE id = ? AND tenant_id = ?", name, classId, auth.tenant.id);
  return { ...classroom, name };
}

async function deleteClass(auth, classId) {
  await getWritableClass(auth, classId);
  await getDb().run("DELETE FROM classes WHERE id = ? AND tenant_id = ?", classId, auth.tenant.id);
}

async function getWritableClass(auth, classId) {
  const classroom = await getDb().get("SELECT * FROM classes WHERE id = ? AND tenant_id = ?", classId, auth.tenant.id);
  if (!classroom) throw Object.assign(new Error("Kelas tidak ditemukan"), { status: 404 });
  if (auth.user.role === "teacher" && classroom.teacher_id !== auth.user.id) {
    throw Object.assign(new Error("Guru hanya boleh mengubah kelas miliknya"), { status: 403 });
  }
  return classroom;
}

async function requestJoinClass(tenantId, studentId, joinCode, membership) {
  const classroom = await getDb().get("SELECT * FROM classes WHERE tenant_id = ? AND join_code = ?", tenantId, joinCode);
  if (!classroom) throw Object.assign(new Error("Kode kelas tidak ditemukan"), { status: 404 });
  await getDb().run(
    `INSERT OR REPLACE INTO class_memberships (id, tenant_id, class_id, student_id, status, requested_at, approved_at)
     VALUES (?, ?, ?, ?, 'pending', ?, NULL)`,
    membership.id,
    tenantId,
    classroom.id,
    studentId,
    membership.requestedAt
  );
  return classroom;
}

async function approveMembership(tenantId, teacherId, membershipId) {
  const result = await getDb().run(
    `UPDATE class_memberships
     SET status = 'approved', approved_at = ?
     WHERE id = ?
       AND tenant_id = ?
       AND class_id IN (SELECT id FROM classes WHERE teacher_id = ?)`,
    new Date().toISOString(),
    membershipId,
    tenantId,
    teacherId
  );
  if (!result.changes) throw Object.assign(new Error("Request join tidak ditemukan"), { status: 404 });
}

async function updateMembershipStatus(auth, membershipId, status) {
  if (!["approved", "rejected", "pending"].includes(status)) {
    throw Object.assign(new Error("Status membership tidak valid"), { status: 400 });
  }
  const result = await getDb().run(
    `UPDATE class_memberships
     SET status = ?, approved_at = CASE WHEN ? = 'approved' THEN ? ELSE approved_at END
     WHERE id = ?
       AND tenant_id = ?
       AND class_id IN (SELECT id FROM classes WHERE teacher_id = ?)`,
    status,
    status,
    new Date().toISOString(),
    membershipId,
    auth.tenant.id,
    auth.user.id
  );
  if (!result.changes) throw Object.assign(new Error("Membership tidak ditemukan"), { status: 404 });
}

async function deleteMembership(auth, membershipId) {
  const result = await getDb().run(
    `DELETE FROM class_memberships
     WHERE id = ?
       AND tenant_id = ?
       AND (
         student_id = ?
         OR class_id IN (SELECT id FROM classes WHERE teacher_id = ?)
       )`,
    membershipId,
    auth.tenant.id,
    auth.user.id,
    auth.user.id
  );
  if (!result.changes) throw Object.assign(new Error("Membership tidak ditemukan"), { status: 404 });
}

async function saveSubmission(tenantId, userId, submission, bypassCheck = false) {
  if (userId && !bypassCheck) {
    await assertCanSubmitAssessment(tenantId, userId, submission.assessmentId);
  }
  const insert = (assessmentId) =>
    getDb().run(
      `INSERT OR REPLACE INTO submissions (id, tenant_id, assessment_id, student_name, user_id, final_score, payload, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      submission.id,
      tenantId,
      assessmentId,
      submission.studentName,
      userId,
      submission.finalScore,
      JSON.stringify(submission),
      submission.submittedAt
    );
  try {
    await insert(submission.assessmentId);
  } catch (err) {
    // FK violation when the assessment row is missing (e.g. the assessment was
    // shown to the student but never persisted, or was deleted). Never lose the
    // student's work: retry with assessment_id = NULL, mirroring the trace
    // persister's FK-safe fallback.
    // Only retry with NULL for actual FK violations, not UNIQUE/CHECK/etc.
    const msg = String(err.message || err);
    if (msg.includes("FOREIGN KEY constraint failed") || msg.includes("SQLITE_CONSTRAINT_FOREIGNKEY")) {
      await insert(null);
    } else {
      throw err;
    }
  }
  return submission;
}

async function assertCanSubmitAssessment(tenantId, userId, assessmentId) {
  const assessment = await getDb().get(
    "SELECT id, class_id, status, payload FROM assessments WHERE id = ? AND tenant_id = ?",
    assessmentId,
    tenantId
  );
  // If the assessment is not in the DB, do NOT hard-fail the submission save.
  // The student was shown this assessment (it was in their state), so blocking
  // the save would silently discard their work. This mirrors the FK-safe
  // fallback used by the trace persister. All real checks below still apply
  // whenever the assessment IS present.
  if (!assessment) return;
  if (assessment.status !== "published") {
    throw Object.assign(new Error("Assessment belum tersedia untuk dikerjakan"), { status: 403 });
  }

  const membership = await getDb().get(
    `SELECT id FROM class_memberships
     WHERE tenant_id = ?
       AND class_id = ?
       AND student_id = ?
       AND status = 'approved'`,
    tenantId,
    assessment.class_id,
    userId
  );
  if (!membership) {
    throw Object.assign(new Error("Siswa belum disetujui di kelas assessment ini"), { status: 403 });
  }

  const payload = JSON.parse(assessment.payload);
  // Unlimited retakes: no enforcement beyond membership.
  if (payload.allowRetakes === true) return;

  const maxAttempts = Math.max(1, Number(payload.maxAttempts) || 1);
  const existing = await getDb().get(
    "SELECT COUNT(*) AS cnt FROM submissions WHERE tenant_id = ? AND assessment_id = ? AND user_id = ?",
    tenantId,
    assessmentId,
    userId
  );
  const used = Number(existing?.cnt || 0);
  if (used >= maxAttempts) {
    throw Object.assign(
      new Error(`Batas percobaan tercapai (${maxAttempts} dari ${maxAttempts})`),
      { status: 409 }
    );
  }
}

async function clearData(tenantId) {
  const database = getDb();
  // Delete evaluation data first (FK-referenced by submissions/assessments).
  await database.run("DELETE FROM evaluation_events WHERE run_id IN (SELECT run_id FROM evaluation_runs WHERE tenant_id = ?)", tenantId);
  await database.run("DELETE FROM evaluation_results WHERE run_id IN (SELECT run_id FROM evaluation_runs WHERE tenant_id = ?)", tenantId);
  await database.run("DELETE FROM evaluation_criteria WHERE run_id IN (SELECT run_id FROM evaluation_runs WHERE tenant_id = ?)", tenantId);
  await database.run("DELETE FROM evaluation_versions WHERE run_id IN (SELECT run_id FROM evaluation_runs WHERE tenant_id = ?)", tenantId);
  await database.run("DELETE FROM evaluation_human_scores WHERE run_id IN (SELECT run_id FROM evaluation_runs WHERE tenant_id = ?)", tenantId);
  await database.run("DELETE FROM human_approvals WHERE tenant_id = ?", tenantId);
  await database.run("DELETE FROM evaluation_runs WHERE tenant_id = ?", tenantId);
  await database.run("DELETE FROM ai_logs WHERE tenant_id = ?", tenantId);
  await database.run("DELETE FROM submissions WHERE tenant_id = ?", tenantId);
  await database.run("DELETE FROM assessments WHERE tenant_id = ?", tenantId);
  await database.run("DELETE FROM question_bank WHERE tenant_id = ?", tenantId);
}

async function saveQuestionToBank(auth, question) {
  const db = getDb();
  const id = cryptoRandom();
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO question_bank (id, tenant_id, teacher_id, topic, difficulty, prompt, focus, outcome, rubric, ideal, criteria, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    auth.tenant.id,
    auth.user.id,
    String(question.topic || "").trim(),
    String(question.difficulty || "").trim(),
    String(question.prompt || "").trim(),
    String(question.focus || "").trim(),
    String(question.outcome || "").trim(),
    String(question.rubric || "").trim(),
    String(question.ideal || "").trim(),
    JSON.stringify(Array.isArray(question.criteria) ? question.criteria : []),
    now,
    now
  );
  return { id };
}

async function listQuestionBank(auth, filter = {}) {
  const db = getDb();
  const { topic, difficulty } = filter;
  let sql = "SELECT * FROM question_bank WHERE tenant_id = ? AND teacher_id = ?";
  const params = [auth.tenant.id, auth.user.id];
  if (topic) { sql += " AND topic LIKE ?"; params.push(`%${topic}%`); }
  if (difficulty) { sql += " AND difficulty = ?"; params.push(difficulty); }
  sql += " ORDER BY created_at DESC";
  const rows = await db.all(sql, ...params);
  return rows.map((r) => ({
    id: r.id,
    topic: r.topic,
    difficulty: r.difficulty,
    prompt: r.prompt,
    focus: r.focus,
    outcome: r.outcome,
    rubric: r.rubric,
    ideal: r.ideal,
    criteria: JSON.parse(r.criteria || "[]"),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

async function deleteQuestionFromBank(auth, questionId) {
  const db = getDb();
  await db.run(
    "DELETE FROM question_bank WHERE id = ? AND tenant_id = ? AND teacher_id = ?",
    questionId,
    auth.tenant.id,
    auth.user.id
  );
}

function cryptoRandom() {
  return crypto.randomUUID().replace(/-/g, "");
}

module.exports = {
  clearData,
  approveMembership,
  createClass,
  deleteAssessment,
  deleteClass,
  deleteMembership,
  getDb,
  getState,
  getSubmissionDetail,
  initDatabase,
  requestJoinClass,
  saveAssessment,
  saveSubmission,
  updateAssessment,
  updateClass,
  updateMembershipStatus,
  assertCanSubmitAssessment,
  stripSubmissionAudio,
  saveQuestionToBank,
  listQuestionBank,
  deleteQuestionFromBank,
};
