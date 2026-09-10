const crypto = require("node:crypto");
const { loadEnv } = require("../server/config");
loadEnv();

const { getDb, initDatabase } = require("../server/database");
const { registerTenantUser, createTenantUser } = require("../server/auth-service");
const { seedDemoData } = require("../server/seed-demo");

const DEFAULTS = {
  tenantName: "Pendopo",
  password: "Pendopo2026!",
  admin: { name: "Admin Pendopo", email: "admin@pendopo.lisan.ai", role: "admin" },
  teacher: { name: "Dosen Pendopo", email: "dosen@pendopo.lisan.ai", role: "teacher" },
  student1: { name: "Mahasiswa 1", email: "mahasiswa1@pendopo.lisan.ai", role: "student" },
  student2: { name: "Mahasiswa 2", email: "mahasiswa2@pendopo.lisan.ai", role: "student" },
};

function uid(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

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

async function ensureAccount(db, tenantId, spec, password) {
  let user = await db.get(
    "SELECT * FROM users WHERE tenant_id = ? AND email = ?",
    tenantId,
    spec.email
  );

  if (!user) {
    const existing = await db.get("SELECT * FROM users WHERE email = ?", spec.email);
    if (existing && existing.tenant_id !== tenantId) {
      throw new Error(`Email ${spec.email} sudah dipakai tenant lain.`);
    }
    user = await createTenantUser(tenantId, {
      name: spec.name,
      email: spec.email,
      password,
      role: spec.role,
    });
  }

  await db.run(
    "UPDATE users SET name = ?, role = ?, password_hash = ? WHERE id = ? AND tenant_id = ?",
    spec.name,
    spec.role,
    await hashPassword(password),
    user.id,
    tenantId
  );

  return { ...user, name: spec.name, email: spec.email, role: spec.role };
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
    tenant = result.tenant;
    return { tenant, admin: result.user };
  }

  const admin = await ensureAccount(db, tenant.id, DEFAULTS.admin, DEFAULTS.password);
  return { tenant, admin };
}

async function renameSeedAccounts(db, tenantId, teacher, student1, student2) {
  const tag = tenantSlug(tenantId);
  const genericTeacherEmail = `guru.${tag}.demo@lisan.ai`;

  let teacherSource = await db.get(
    "SELECT * FROM users WHERE tenant_id = ? AND email = ?",
    tenantId,
    genericTeacherEmail
  );
  if (!teacherSource) {
    teacherSource = await db.get(
      "SELECT * FROM users WHERE tenant_id = ? AND email = ?",
      tenantId,
      teacher.email
    );
  }
  if (!teacherSource) throw new Error("Akun dosen seed tidak ditemukan.");

  if (teacherSource.email !== teacher.email) {
    await db.run(
      "UPDATE users SET name = ?, email = ?, role = ? WHERE id = ? AND tenant_id = ?",
      teacher.name,
      teacher.email,
      teacher.role,
      teacherSource.id,
      tenantId
    );
  } else {
    await db.run(
      "UPDATE users SET name = ?, role = ? WHERE id = ? AND tenant_id = ?",
      teacher.name,
      teacher.role,
      teacherSource.id,
      tenantId
    );
  }

  const classRow = await db.get(
    "SELECT id FROM classes WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1",
    tenantId
  );
  if (classRow) {
    await db.run(
      "UPDATE classes SET name = ?, teacher_id = ? WHERE id = ? AND tenant_id = ?",
      "Pendopo - Kelas A",
      teacherSource.id,
      classRow.id,
      tenantId
    );
  }

  let students = await db.all(
    `SELECT u.*
       FROM users u
       JOIN class_memberships cm ON cm.student_id = u.id
      WHERE u.tenant_id = ? AND u.role = 'student' AND cm.class_id = ?
      ORDER BY cm.requested_at ASC`,
    tenantId,
    classRow?.id || ""
  );

  const desired = [student1, student2];
  for (let i = 0; i < desired.length; i += 1) {
    let source = await db.get(
      "SELECT * FROM users WHERE tenant_id = ? AND email = ?",
      tenantId,
      desired[i].email
    );
    if (!source) source = students[i];
    if (!source) throw new Error(`Akun mahasiswa ${i + 1} seed tidak ditemukan.`);

    if (source.email !== desired[i].email) {
      await db.run(
        "UPDATE users SET name = ?, email = ?, role = ? WHERE id = ? AND tenant_id = ?",
        desired[i].name,
        desired[i].email,
        desired[i].role,
        source.id,
        tenantId
      );
    } else {
      await db.run(
        "UPDATE users SET name = ?, role = ? WHERE id = ? AND tenant_id = ?",
        desired[i].name,
        desired[i].role,
        source.id,
        tenantId
      );
    }

    const submissions = await db.all(
      "SELECT id, payload FROM submissions WHERE tenant_id = ? AND user_id = ?",
      tenantId,
      source.id
    );
    for (const submission of submissions) {
      let payload;
      try {
        payload = JSON.parse(submission.payload);
      } catch {
        payload = null;
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

  // Keep the showcase focused on exactly two student accounts. Remove the
  // additional students generated by the generic demo seeder, together with
  // their submissions/evaluation traces.
  const keepIds = [];
  for (const account of desired) {
    const row = await db.get("SELECT id FROM users WHERE tenant_id = ? AND email = ?", tenantId, account.email);
    if (row) keepIds.push(row.id);
  }
  const extras = await db.all(
    `SELECT id FROM users
      WHERE tenant_id = ? AND role = 'student'
        AND id NOT IN (${keepIds.map(() => "?").join(",") || "NULL"})`,
    tenantId,
    ...keepIds
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

  return {
    teacherId: teacherSource.id,
    studentIds: keepIds,
    classId: classRow?.id || null,
  };
}

async function main() {
  await initDatabase();
  const db = getDb();
  const { tenant, admin } = await ensureTenantAndAdmin(db);
  const tenantId = tenant.id;

  // Reuse the production-quality demo dataset so Pendopo exercises the same
  // Dashboard, Assessment, Monitoring, Complaint, Research, Observability,
  // and API-key surfaces as the existing demo.
  await seedDemoData(
    { tenant: { id: tenantId }, user: { id: admin.id, role: "admin", name: admin.name } },
    "admin"
  );

  const teacher = await ensureAccount(db, tenantId, DEFAULTS.teacher, DEFAULTS.password);
  const student1 = await ensureAccount(db, tenantId, DEFAULTS.student1, DEFAULTS.password);
  const student2 = await ensureAccount(db, tenantId, DEFAULTS.student2, DEFAULTS.password);
  const normalized = await renameSeedAccounts(db, tenantId, teacher, student1, student2);

  console.log("\n=== PENDOPO DEMO ===");
  console.log(`Tenant   : ${DEFAULTS.tenantName}`);
  console.log(`Password : ${DEFAULTS.password}`);
  console.log(`Admin    : ${DEFAULTS.admin.email}`);
  console.log(`Dosen    : ${DEFAULTS.teacher.email}`);
  console.log(`Mahasiswa 1: ${DEFAULTS.student1.email}`);
  console.log(`Mahasiswa 2: ${DEFAULTS.student2.email}`);
  console.log(`Tenant ID: ${tenantId}`);
  console.log(`Class ID : ${normalized.classId}`);
  console.log("====================\n");
}

main().catch((error) => {
  console.error("Pendopo demo provisioning failed:", error);
  process.exit(1);
});
