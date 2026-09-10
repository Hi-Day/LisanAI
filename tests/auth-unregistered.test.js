const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const dbPath = path.join(os.tmpdir(), `oralai-auth-unregistered-${Date.now()}.db`);
process.env.TURSO_DATABASE_URL = `file:${dbPath}`;
process.env.ENABLE_DEMO_SIMULATION = "false";

const { initDatabase } = require("../server/database");
const { loginUser, registerTenantUser } = require("../server/auth-service");

test.before(async () => {
  fs.rmSync(dbPath, { force: true });
  await initDatabase();
  await registerTenantUser({
    tenantName: "Auth Error Test School",
    name: "Auth Error Admin",
    email: "registered@example.com",
    password: "password123",
  });
});

test.after(() => {
  fs.rmSync(dbPath, { force: true });
});

test("loginUser returns 404 when the account is not registered", async () => {
  await assert.rejects(
    () => loginUser({ email: "unregistered@example.com", password: "password123" }),
    { status: 404, message: "Akun belum terdaftar. Silakan daftar terlebih dahulu." }
  );
});

test("loginUser returns 401 when the account exists but the password is wrong", async () => {
  await assert.rejects(
    () => loginUser({ email: "registered@example.com", password: "wrong-password" }),
    { status: 401, message: "Password salah" }
  );
});
