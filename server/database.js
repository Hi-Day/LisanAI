const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@libsql/client");
const { ROOT } = require("./config");

const DATA_DIR = path.join(ROOT, "data");

let db;
let libsqlClient;

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
      const rs = await libsqlClient.execute({ sql, args: params });
      return rs.rows;
    },
    async get(sql, ...params) {
      const rs = await libsqlClient.execute({ sql, args: params });
      return rs.rows[0];
    },
    async run(sql, ...params) {
      const rs = await libsqlClient.execute({ sql, args: params });
      return { changes: rs.rowsAffected, lastID: rs.lastInsertRowid };
    },
    async exec(sql) {
      await libsqlClient.executeMultiple(sql);
    }
  };

  await db.exec("PRAGMA foreign_keys = ON");
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'starter',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
      created_at TEXT NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      class_id TEXT,
      teacher_id TEXT,
      status TEXT DEFAULT 'published',
      topic TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      teacher_id TEXT NOT NULL,
      name TEXT NOT NULL,
      join_code TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS class_memberships (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
      requested_at TEXT NOT NULL,
      approved_at TEXT,
      UNIQUE (class_id, student_id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      assessment_id TEXT NOT NULL,
      student_name TEXT NOT NULL,
      user_id TEXT,
      final_score INTEGER NOT NULL,
      payload TEXT NOT NULL,
      submitted_at TEXT NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
    );
  `);
  await ensureColumn("assessments", "tenant_id", "TEXT");
  await ensureColumn("assessments", "class_id", "TEXT");
  await ensureColumn("assessments", "teacher_id", "TEXT");
  await ensureColumn("assessments", "status", "TEXT DEFAULT 'published'");
  await ensureColumn("submissions", "tenant_id", "TEXT");
  await ensureColumn("submissions", "user_id", "TEXT");
  await recordMigration(1, "initial_schema_with_auth_classes");
  await runFileMigrations();
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
  return {
    assessments: assessments.map((row) => JSON.parse(row.payload)),
    submissions: submissions.map((row) => JSON.parse(row.payload)),
    classes,
    memberships,
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
       ORDER BY datetime(assessments.created_at) DESC`,
      auth.tenant.id,
      auth.user.id
    );
  }

  if (auth.user.role === "teacher") {
    return database.all(
      "SELECT payload FROM assessments WHERE tenant_id = ? AND teacher_id = ? ORDER BY datetime(created_at) DESC",
      auth.tenant.id,
      auth.user.id
    );
  }

  return database.all(
    "SELECT payload FROM assessments WHERE tenant_id = ? ORDER BY datetime(created_at) DESC",
    auth.tenant.id
  );
}

async function getVisibleSubmissions(database, auth) {
  if (auth.user.role === "student") {
    return database.all(
      "SELECT payload FROM submissions WHERE tenant_id = ? AND user_id = ? ORDER BY datetime(submitted_at) ASC",
      auth.tenant.id,
      auth.user.id
    );
  }

  return database.all(
    "SELECT payload FROM submissions WHERE tenant_id = ? ORDER BY datetime(submitted_at) ASC",
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
       ORDER BY datetime(classes.created_at) DESC`,
      auth.tenant.id,
      auth.user.id
    );
  }

  if (auth.user.role === "teacher") {
    return database.all(
      "SELECT *, 'teacher' AS status FROM classes WHERE tenant_id = ? AND teacher_id = ? ORDER BY datetime(created_at) DESC",
      auth.tenant.id,
      auth.user.id
    );
  }

  return database.all(
    "SELECT *, 'admin' AS status FROM classes WHERE tenant_id = ? ORDER BY datetime(created_at) DESC",
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
     ORDER BY datetime(class_memberships.requested_at) DESC`,
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

async function saveSubmission(tenantId, userId, submission) {
  if (userId) {
    // Membolehkan siswa submit berulang kali agar bisa melihat perkembangan skor (trend)
  }
  await getDb().run(
    `INSERT OR REPLACE INTO submissions (id, tenant_id, assessment_id, student_name, user_id, final_score, payload, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    submission.id,
    tenantId,
    submission.assessmentId,
    submission.studentName,
    userId,
    submission.finalScore,
    JSON.stringify(submission),
    submission.submittedAt
  );
  return submission;
}

async function clearData(tenantId) {
  const database = getDb();
  await database.run("DELETE FROM submissions WHERE tenant_id = ?", tenantId);
  await database.run("DELETE FROM assessments WHERE tenant_id = ?", tenantId);
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
  initDatabase,
  requestJoinClass,
  saveAssessment,
  saveSubmission,
  updateAssessment,
  updateClass,
  updateMembershipStatus,
};
