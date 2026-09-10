const crypto = require("node:crypto");
const { loadEnv } = require("../server/config");
loadEnv();

const { getDb, initDatabase } = require("../server/database");
const { registerTenantUser } = require("../server/auth-service");
const { seedDemoData } = require("../server/seed-demo");

const DEFAULTS = {
  tenantName: "Lisan.ai Showcase Demo",
  adminName: "Demo Admin Lisan.ai",
  adminEmail: "demo@lisan.ai",
  password: "LisanDemo2026!",
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

async function getOrCreateAdmin(db) {
  const tenantName = process.env.SHOWCASE_TENANT_NAME || DEFAULTS.tenantName;
  const adminName = process.env.SHOWCASE_ADMIN_NAME || DEFAULTS.adminName;
  const adminEmail = process.env.SHOWCASE_ADMIN_EMAIL || DEFAULTS.adminEmail;
  const password = process.env.SHOWCASE_ADMIN_PASSWORD || DEFAULTS.password;

  let admin = await db.get("SELECT * FROM users WHERE email = ?", adminEmail);
  if (admin) {
    if (admin.role !== "admin") {
      throw new Error(`Akun ${adminEmail} sudah ada tetapi bukan admin.`);
    }

    // Make the published showcase credentials deterministic. This also fixes
    // an already-provisioned account whose password came from an older env
    // value or an earlier deployment.
    await db.run(
      "UPDATE users SET name = ?, password_hash = ? WHERE id = ?",
      adminName,
      await hashPassword(password),
      admin.id
    );
    admin.name = adminName;
    return { admin, password, created: false, tenantName };
  }

  const result = await registerTenantUser({
    tenantName,
    name: adminName,
    email: adminEmail,
    password,
  });

  return { admin: result.user, password, created: true, tenantName };
}

async function main() {
  await initDatabase();
  const db = getDb();

  const { admin, password, created, tenantName } = await getOrCreateAdmin(db);
  const tenantId = admin.tenant_id || admin.tenantId;
  if (!tenantId) throw new Error("Tenant ID tidak ditemukan pada akun demo.");

  // Reuse the production demo seeder so this account exercises the same
  // tenant-scoped teacher/admin flows as the in-app demo buttons.
  const result = await seedDemoData(
    { tenant: { id: tenantId }, user: { id: admin.id, role: "admin" } },
    "admin"
  );

  console.log("\n=== LISAN.AI SHOWCASE DEMO ===");
  console.log(`Tenant : ${tenantName}`);
  console.log(`Email  : ${admin.email}`);
  console.log(`Password: ${password}`);
  console.log(`Tenant ID: ${tenantId}`);
  console.log(`Admin created: ${created}`);
  console.log(`Seed result: ${JSON.stringify(result)}`);
  console.log("==============================\n");
}

main().catch((error) => {
  console.error("Showcase demo provisioning failed:", error);
  process.exit(1);
});
