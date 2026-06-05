const { getDb, initDatabase } = require("../server/database");
const { createTenantUser, registerTenantUser } = require("../server/auth-service");

async function seedTestAccounts() {
  await initDatabase();
  const db = getDb();
  console.log("Seeding test accounts...");

  const testPassword = "password123";

  // Check if tenant exists, if not create one via registerTenantUser
  let adminUser;
  try {
    const res = await registerTenantUser({
      tenantName: "Demo School",
      name: "Admin Demo",
      email: "admin@oralai.test",
      password: testPassword,
    });
    adminUser = res.user;
    console.log("Created Admin account:", adminUser.email);
  } catch (err) {
    if (err.message === "Email sudah terdaftar") {
      adminUser = await db.get("SELECT * FROM users WHERE email = ?", "admin@oralai.test");
      console.log("Admin account already exists:", adminUser.email);
    } else {
      console.error("Error creating admin:", err);
      return;
    }
  }

  const tenantId = adminUser.tenant_id || adminUser.tenantId;

  // Create Teacher
  try {
    const teacher = await createTenantUser(tenantId, {
      name: "Guru Demo",
      email: "guru@oralai.test",
      password: testPassword,
      role: "teacher"
    });
    console.log("Created Teacher account:", teacher.email);
  } catch (err) {
    if (err.message === "Email sudah terdaftar") {
      console.log("Teacher account already exists: guru@oralai.test");
    } else {
      console.error("Error creating teacher:", err);
    }
  }

  // Create Student
  try {
    const student = await createTenantUser(tenantId, {
      name: "Siswa Demo",
      email: "siswa@oralai.test",
      password: testPassword,
      role: "student"
    });
    console.log("Created Student account:", student.email);
  } catch (err) {
    if (err.message === "Email sudah terdaftar") {
      console.log("Student account already exists: siswa@oralai.test");
    } else {
      console.error("Error creating student:", err);
    }
  }

  console.log("Done seeding!");
}

seedTestAccounts();
