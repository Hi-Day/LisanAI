const { loadEnv } = require("../server/config");
loadEnv();

const { getDb, initDatabase } = require("../server/database");
const { seedCompetencyDemoData } = require("../server/seed-competency-demo");

async function main() {
  await initDatabase();
  const db = getDb();
  const admin = await db.get("SELECT * FROM users WHERE email = ?", "demo@lisan.ai");
  if (!admin) throw new Error("Akun showcase demo belum ada. Jalankan npm run seed:showcase terlebih dahulu.");
  if (admin.role !== "admin") throw new Error("Akun showcase demo bukan admin.");

  const result = await seedCompetencyDemoData({
    tenant: { id: admin.tenant_id || admin.tenantId },
    user: { id: admin.id, role: admin.role },
  });

  console.log("Competency demo seed repaired:", JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("Competency demo repair failed:", error);
  process.exit(1);
});
