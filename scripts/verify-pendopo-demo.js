const { loadEnv } = require("../server/config");
loadEnv();

const { getDb, initDatabase } = require("../server/database");

const EXPECTED = {
  tenant: "Pendopo",
  accounts: [
    ["admin@pendopo.lisan.ai", "admin"],
    ["dosen@pendopo.lisan.ai", "teacher"],
    ["mahasiswa1@pendopo.lisan.ai", "student"],
    ["mahasiswa2@pendopo.lisan.ai", "student"],
  ],
};

async function main() {
  if (process.env.VERCEL_ENV !== "production") {
    console.log(`Skipping Pendopo verification for VERCEL_ENV=${process.env.VERCEL_ENV || "unknown"}.`);
    return;
  }

  await initDatabase();
  const db = getDb();
  const tenant = await db.get("SELECT id, name FROM tenants WHERE name = ?", EXPECTED.tenant);
  if (!tenant) throw new Error("Pendopo verification failed: tenant Pendopo tidak ditemukan.");

  for (const [email, role] of EXPECTED.accounts) {
    const user = await db.get(
      "SELECT id, email, role FROM users WHERE tenant_id = ? AND email = ?",
      tenant.id,
      email
    );
    if (!user) throw new Error(`Pendopo verification failed: akun ${email} tidak ditemukan.`);
    if (user.role !== role) {
      throw new Error(`Pendopo verification failed: akun ${email} memiliki role ${user.role}, expected ${role}.`);
    }
  }

  const classroom = await db.get(
    "SELECT id, name, teacher_id FROM classes WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1",
    tenant.id
  );
  if (!classroom || classroom.name !== "Pendopo - Kelas A") {
    throw new Error("Pendopo verification failed: kelas Pendopo - Kelas A tidak ditemukan.");
  }

  console.log("Pendopo verification passed: tenant, 4 accounts, and class are present in the build-time database.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
