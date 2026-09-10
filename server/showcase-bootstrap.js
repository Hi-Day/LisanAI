const crypto = require("node:crypto");
const { getDb } = require("./database");
const { registerTenantUser, createTenantUser } = require("./auth-service");
const { seedDemoData } = require("./seed-demo");

const DEFAULTS = {
  tenantName: "Lisan.ai Showcase Demo",
  adminName: "Demo Admin Lisan.ai",
  adminEmail: "demo@lisan.ai",
  teacherName: "Dosen Demo Lisan.ai",
  teacherEmail: "dosen@lisan.ai",
  studentName: "Student Demo Lisan.ai",
  studentEmail: "student@lisan.ai",
  password: "LisanDemo2026!",
};

let promise = null;

function uid(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function ensureShowcaseDemo() {
  if (String(process.env.VERCEL_ENV || "").toLowerCase() !== "production") return;
  if (String(process.env.ENABLE_SHOWCASE_DEMO || "true").toLowerCase() !== "true") return;
  if (promise) return promise;

  promise = provision().catch((error) => {
    promise = null;
    throw error;
  });
  return promise;
}

async function provision() {
  const db = getDb();
  const password = process.env.SHOWCASE_ADMIN_PASSWORD || DEFAULTS.password;
  const adminEmail = process.env.SHOWCASE_ADMIN_EMAIL || DEFAULTS.adminEmail;

  let admin = await db.get("SELECT * FROM users WHERE email = ?", adminEmail);
  if (!admin) {
    const result = await registerTenantUser({
      tenantName: process.env.SHOWCASE_TENANT_NAME || DEFAULTS.tenantName,
      name: process.env.SHOWCASE_ADMIN_NAME || DEFAULTS.adminName,
      email: adminEmail,
      password,
    });
    admin = { ...result.user, tenant_id: result.tenant.id };
  }

  const tenantId = admin.tenant_id || admin.tenantId;
  if (!tenantId) throw new Error("Showcase tenant tidak ditemukan.");

  await seedDemoData(
    { tenant: { id: tenantId }, user: { id: admin.id, role: "admin" } },
    "admin"
  );

  const teacherEmail = process.env.SHOWCASE_TEACHER_EMAIL || DEFAULTS.teacherEmail;
  const studentEmail = process.env.SHOWCASE_STUDENT_EMAIL || DEFAULTS.studentEmail;

  let teacher = await db.get("SELECT * FROM users WHERE email = ? AND tenant_id = ?", teacherEmail, tenantId);
  if (!teacher) {
    teacher = await createTenantUser(tenantId, {
      name: process.env.SHOWCASE_TEACHER_NAME || DEFAULTS.teacherName,
      email: teacherEmail,
      password,
      role: "teacher",
    });
  }

  let student = await db.get("SELECT * FROM users WHERE email = ? AND tenant_id = ?", studentEmail, tenantId);
  if (!student) {
    student = await createTenantUser(tenantId, {
      name: process.env.SHOWCASE_STUDENT_NAME || DEFAULTS.studentName,
      email: studentEmail,
      password,
      role: "student",
    });
  }

  const classes = await db.all("SELECT id FROM classes WHERE tenant_id = ?", tenantId);
  for (const classroom of classes) {
    await db.run("UPDATE classes SET teacher_id = ? WHERE id = ? AND tenant_id = ?", teacher.id, classroom.id, tenantId);
    await db.run(
      `INSERT OR IGNORE INTO class_memberships
       (id, tenant_id, class_id, student_id, status, requested_at, approved_at)
       VALUES (?, ?, ?, ?, 'approved', ?, ?)`,
      uid("showcase-membership"), tenantId, classroom.id, student.id,
      new Date().toISOString(), new Date().toISOString()
    );
  }

  await db.run(
    "UPDATE assessments SET teacher_id = ? WHERE tenant_id = ?",
    teacher.id,
    tenantId
  );

  // Re-attach seeded submissions to the showcase student so the student view
  // contains completed/evaluated examples instead of appearing empty.
  await db.run(
    `UPDATE submissions
        SET user_id = ?, student_name = ?
      WHERE tenant_id = ?
        AND assessment_id IN (SELECT id FROM assessments WHERE tenant_id = ?)` ,
    student.id,
    student.name,
    tenantId,
    tenantId
  );

  return { tenantId, adminId: admin.id, teacherId: teacher.id, studentId: student.id };
}

module.exports = { ensureShowcaseDemo };
