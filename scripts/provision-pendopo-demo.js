const crypto = require("node:crypto");
const { loadEnv } = require("../server/config");
loadEnv();

const { getDb, initDatabase } = require("../server/database");
const { registerTenantUser } = require("../server/auth-service");
const { seedDemoData } = require("../server/seed-demo");

const DEFAULTS = {
  tenantName: "Pendopo",
  password: "Pendopo2026!",
  admin: { name: "Admin Pendopo", email: "admin@pendopo.lisan.ai", role: "admin" },
  teacher: { name: "Dosen Pendopo", email: "dosen@pendopo.lisan.ai", role: "teacher" },
  student1: { name: "Mahasiswa 1", email: "mahasiswa1@pendopo.lisan.ai", role: "student" },
  student2: { name: "Mahasiswa 2", email: "mahasiswa2@pendopo.lisan.ai", role: "student" },
};

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(password), salt, 64, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(`scrypt$${salt}$${derivedKey.toString("base64url")}`);
    });
  });
}

function tenantSlug(tenantId) {
  return crypto.createHash("sha256").update(tenantId).digest("hex").slice(0, 8);
}

async function ensureTenantAndAdmin(db) {
  let tenant = await db.get("SELECT * FROM tenants WHERE name = ?", DEFAULTS.tenantName);
  if (!tenant) {
    const result = await registerTenantUser({
      tenantName: DEFAULTS.tenantName,
      name: DEFAULTS.admin.name,
      email: DEFAULTS.admin.email,
      password: DEFAULTS.password,
    });
    return { tenant: result.tenant, admin: result.user };
  }

  let admin = await db.get(
    "SELECT * FROM users WHERE tenant_id = ? AND email = ?",
    tenant.id,
    DEFAULTS.admin.email
  );
  if (!admin) {
    const existing = await db.get("SELECT * FROM users WHERE email = ?", DEFAULTS.admin.email);
    if (existing && existing.tenant_id !== tenant.id) {
      throw new Error(`Email ${DEFAULTS.admin.email} sudah dipakai tenant lain.`);
    }
    const id = `user-${crypto.randomUUID()}`;
    await db.run(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, role, created_at)
       VALUES (?, ?, ?, ?, ?, 'admin', ?)`,
      id,
      tenant.id,
      DEFAULTS.admin.name,
      DEFAULTS.admin.email,
      await hashPassword(DEFAULTS.password),
      new Date().toISOString()
    );
    admin = await db.get("SELECT * FROM users WHERE id = ?", id);
  } else {
    await db.run(
      "UPDATE users SET name = ?, role = 'admin', password_hash = ? WHERE id = ? AND tenant_id = ?",
      DEFAULTS.admin.name,
      await hashPassword(DEFAULTS.password),
      admin.id,
      tenant.id
    );
  }

  return { tenant, admin };
}

async function migrateAccount(db, tenantId, source, target) {
  await db.run(
    `UPDATE users
        SET name = ?, email = ?, role = ?, password_hash = ?
      WHERE id = ? AND tenant_id = ?`,
    target.name,
    target.email,
    target.role,
    await hashPassword(DEFAULTS.password),
    source.id,
    tenantId
  );
  return { ...source, name: target.name, email: target.email, role: target.role };
}

async function normalizePendopoAccounts(db, tenantId) {
  const tag = tenantSlug(tenantId);
  const genericTeacherEmail = `guru.${tag}.demo@lisan.ai`;
  const classRow = await db.get(
    "SELECT * FROM classes WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1",
    tenantId
  );
  if (!classRow) throw new Error("Kelas demo Pendopo tidak ditemukan.");

  let teacher = await db.get(
    "SELECT * FROM users WHERE tenant_id = ? AND email = ?",
    tenantId,
    DEFAULTS.teacher.email
  );
  const genericTeacher = await db.get(
    "SELECT * FROM users WHERE tenant_id = ? AND email = ?",
    tenantId,
    genericTeacherEmail
  );
  if (!teacher) teacher = genericTeacher;
  if (!teacher) throw new Error("Akun dosen seed tidak ditemukan.");

  if (teacher.email !== DEFAULTS.teacher.email) {
    teacher = await migrateAccount(db, tenantId, teacher, DEFAULTS.teacher);
  } else {
    await db.run(
      "UPDATE users SET name = ?, role = 'teacher', password_hash = ? WHERE id = ? AND tenant_id = ?",
      DEFAULTS.teacher.name,
      await hashPassword(DEFAULTS.password),
      teacher.id,
      tenantId
    );
  }

  await db.run(
    "UPDATE classes SET name = ?, teacher_id = ? WHERE id = ? AND tenant_id = ?",
    "Pendopo - Kelas A",
    teacher.id,
    classRow.id,
    tenantId
  );
  await db.run(
    "UPDATE assessments SET teacher_id = ? WHERE tenant_id = ? AND teacher_id = ?",
    teacher.id,
    tenantId,
    genericTeacher?.id || teacher.id
  );
  await db.run(
    "UPDATE ai_logs SET user_id = ? WHERE tenant_id = ? AND user_id = ?",
    teacher.id,
    tenantId,
    genericTeacher?.id || teacher.id
  );

  const students = await db.all(
    `SELECT u.*
       FROM users u
       JOIN class_memberships cm ON cm.student_id = u.id
      WHERE u.tenant_id = ? AND u.role = 'student' AND cm.class_id = ?
      ORDER BY cm.requested_at ASC`,
    tenantId,
    classRow.id
  );

  const desired = [DEFAULTS.student1, DEFAULTS.student2];
  const keptIds = [];
  for (let i = 0; i < desired.length; i += 1) {
    let source = await db.get(
      "SELECT * FROM users WHERE tenant_id = ? AND email = ?",
      tenantId,
      desired[i].email
    );
    if (!source) source = students[i];
    if (!source) throw new Error(`Akun mahasiswa ${i + 1} seed tidak ditemukan.`);

    if (source.email !== desired[i].email) {
      source = await migrateAccount(db, tenantId, source, desired[i]);
    } else {
      await db.run(
        "UPDATE users SET name = ?, role = 'student', password_hash = ? WHERE id = ? AND tenant_id = ?",
        desired[i].name,
        await hashPassword(DEFAULTS.password),
        source.id,
        tenantId
      );
    }
    keptIds.push(source.id);

    const submissions = await db.all(
      "SELECT id, payload FROM submissions WHERE tenant_id = ? AND user_id = ?",
      tenantId,
      source.id
    );
    for (const submission of submissions) {
      let payload = null;
      try {
        payload = JSON.parse(submission.payload);
      } catch {
        // Keep the original payload if it is not valid JSON.
      }
      if (payload) {
        payload.studentName = desired[i].name;
        await db.run(
          "UPDATE submissions SET student_name = ?, payload = ? WHERE id = ? AND tenant_id = ?",
          desired[i].name,
          JSON.stringify(payload),
          submission.id,
          tenantId
        );
      } else {
        await db.run(
          "UPDATE submissions SET student_name = ? WHERE id = ? AND tenant_id = ?",
          desired[i].name,
          submission.id,
          tenantId
        );
      }
    }
  }

  const placeholders = keptIds.map(() => "?").join(",");
  const extras = await db.all(
    `SELECT id FROM users
      WHERE tenant_id = ? AND role = 'student'
        AND id NOT IN (${placeholders})`,
    tenantId,
    ...keptIds
  );
  for (const extra of extras) {
    const submissions = await db.all(
      "SELECT id FROM submissions WHERE tenant_id = ? AND user_id = ?",
      tenantId,
      extra.id
    );
    for (const submission of submissions) {
      await db.run(
        "DELETE FROM evaluation_runs WHERE tenant_id = ? AND submission_id = ?",
        tenantId,
        submission.id
      );
      await db.run(
        "DELETE FROM submissions WHERE tenant_id = ? AND id = ?",
        tenantId,
        submission.id
      );
    }
    await db.run("DELETE FROM users WHERE tenant_id = ? AND id = ?", tenantId, extra.id);
  }

  if (genericTeacher && genericTeacher.id !== teacher.id) {
    await db.run("DELETE FROM users WHERE tenant_id = ? AND id = ?", tenantId, genericTeacher.id);
  }

  return { teacherId: teacher.id, studentIds: keptIds, classId: classRow.id };
}

async function main() {
  await initDatabase();
  const db = getDb();
  const { tenant, admin } = await ensureTenantAndAdmin(db);
  const tenantId = tenant.id;

  const seeded = await db.get(
    "SELECT COUNT(*) AS c FROM assessments WHERE tenant_id = ?",
    tenantId
  );
  if (!Number(seeded?.c || 0)) {
    await seedDemoData(
      { tenant: { id: tenantId }, user: { id: admin.id, role: "admin", name: admin.name } },
      "admin"
    );
  }

  const normalized = await normalizePendopoAccounts(db, tenantId);

  console.log("\n=== PENDOPO DEMO ===");
  console.log(`Tenant     : ${DEFAULTS.tenantName}`);
  console.log(`Password   : ${DEFAULTS.password}`);
  console.log(`Admin      : ${DEFAULTS.admin.email}`);
  console.log(`Dosen      : ${DEFAULTS.teacher.email}`);
  console.log(`Mahasiswa 1: ${DEFAULTS.student1.email}`);
  console.log(`Mahasiswa 2: ${DEFAULTS.student2.email}`);
  console.log(`Tenant ID  : ${tenantId}`);
  console.log(`Class ID   : ${normalized.classId}`);
  console.log("====================\n");
}

main().catch((error) => {
  console.error("Pendopo demo provisioning failed:", error);
  process.exit(1);
});
