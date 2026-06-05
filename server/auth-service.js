const crypto = require("node:crypto");
const { getDb } = require("./database");

const SESSION_COOKIE = "oralai_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function uid(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function registerTenantUser({ tenantName, name, email, password }) {
  validateCredentials({ email, password });
  const database = getDb();
  const now = new Date().toISOString();
  const tenant = {
    id: uid("tenant"),
    name: String(tenantName || "Tenant Baru").trim(),
    plan: "starter",
    createdAt: now,
  };
  const user = {
    id: uid("user"),
    tenantId: tenant.id,
    name: String(name || "Admin").trim(),
    email: normalizeEmail(email),
    role: "admin",
    createdAt: now,
  };
  const existing = await database.get("SELECT id FROM users WHERE email = ?", user.email);
  if (existing) throw Object.assign(new Error("Email sudah terdaftar"), { status: 409 });

  await database.run("BEGIN");
  try {
    await database.run(
      "INSERT INTO tenants (id, name, plan, created_at) VALUES (?, ?, ?, ?)",
      tenant.id,
      tenant.name,
      tenant.plan,
      tenant.createdAt
    );
    await database.run(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      user.id,
      user.tenantId,
      user.name,
      user.email,
      await hashPassword(password),
      user.role,
      user.createdAt
    );
    await database.run("COMMIT");
  } catch (error) {
    await database.run("ROLLBACK");
    throw error;
  }

  return { tenant, user };
}

async function createTenantUser(tenantId, { name, email, password, role }) {
  validateCredentials({ email, password });
  const normalizedRole = normalizeRole(role);
  const database = getDb();
  const user = {
    id: uid("user"),
    tenantId,
    name: String(name || "").trim(),
    email: normalizeEmail(email),
    role: normalizedRole,
    createdAt: new Date().toISOString(),
  };

  if (!user.name) throw Object.assign(new Error("Nama user wajib diisi"), { status: 400 });
  const existing = await database.get("SELECT id FROM users WHERE email = ?", user.email);
  if (existing) throw Object.assign(new Error("Email sudah terdaftar"), { status: 409 });

  await database.run(
    `INSERT INTO users (id, tenant_id, name, email, password_hash, role, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    user.id,
    user.tenantId,
    user.name,
    user.email,
    await hashPassword(password),
    user.role,
    user.createdAt
  );

  return user;
}

async function listTenantUsers(tenantId) {
  const rows = await getDb().all(
    "SELECT id, tenant_id, name, email, role, created_at FROM users WHERE tenant_id = ? ORDER BY datetime(created_at) DESC",
    tenantId
  );
  return rows.map(mapUser);
}

async function updateTenantUser(tenantId, userId, patch) {
  const existing = await getDb().get("SELECT * FROM users WHERE id = ? AND tenant_id = ?", userId, tenantId);
  if (!existing) throw Object.assign(new Error("User tidak ditemukan"), { status: 404 });
  const name = String(patch.name || existing.name).trim();
  const role = patch.role ? normalizeRole(patch.role) : existing.role;
  await getDb().run(
    "UPDATE users SET name = ?, role = ? WHERE id = ? AND tenant_id = ?",
    name,
    role,
    userId,
    tenantId
  );
  return mapUser({ ...existing, name, role });
}

async function deleteTenantUser(tenantId, userId, currentUserId) {
  if (userId === currentUserId) throw Object.assign(new Error("Tidak bisa menghapus akun sendiri"), { status: 400 });
  const result = await getDb().run("DELETE FROM users WHERE id = ? AND tenant_id = ?", userId, tenantId);
  if (!result.changes) throw Object.assign(new Error("User tidak ditemukan"), { status: 404 });
}

async function loginUser({ email, password }) {
  validateCredentials({ email, password });
  const database = getDb();
  const row = await database.get(
    `SELECT users.*, tenants.name AS tenant_name, tenants.plan AS tenant_plan
     FROM users
     JOIN tenants ON tenants.id = users.tenant_id
     WHERE users.email = ?`,
    normalizeEmail(email)
  );
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    throw Object.assign(new Error("Email atau password salah"), { status: 401 });
  }

  return {
    tenant: mapTenant(row),
    user: mapUser(row),
  };
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();

  await getDb().run(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
    uid("session"),
    userId,
    tokenHash,
    expiresAt,
    now.toISOString()
  );

  return { token, expiresAt };
}

async function getSessionUser(token) {
  if (!token) return null;
  const row = await getDb().get(
    `SELECT sessions.id AS session_id, sessions.expires_at, users.*, tenants.name AS tenant_name, tenants.plan AS tenant_plan
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     JOIN tenants ON tenants.id = users.tenant_id
     WHERE sessions.token_hash = ?`,
    hashToken(token)
  );
  if (!row) return null;
  if (new Date(row.expires_at) <= new Date()) {
    await deleteSession(token);
    return null;
  }
  return {
    sessionId: row.session_id,
    tenant: mapTenant(row),
    user: mapUser(row),
  };
}

async function deleteSession(token) {
  if (!token) return;
  await getDb().run("DELETE FROM sessions WHERE token_hash = ?", hashToken(token));
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = await scrypt(password, salt);
  return `scrypt$${salt}$${hash}`;
}

async function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored || "").split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = await scrypt(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(candidate));
}

function scrypt(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(password), salt, 64, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey.toString("base64url"));
    });
  });
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function validateCredentials({ email, password }) {
  if (!normalizeEmail(email).includes("@")) {
    throw Object.assign(new Error("Email tidak valid"), { status: 400 });
  }
  if (String(password || "").length < 8) {
    throw Object.assign(new Error("Password minimal 8 karakter"), { status: 400 });
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeRole(role) {
  const normalized = String(role || "").trim().toLowerCase();
  if (!["admin", "teacher", "student"].includes(normalized)) {
    throw Object.assign(new Error("Role tidak valid"), { status: 400 });
  }
  return normalized;
}

function mapTenant(row) {
  return {
    id: row.tenant_id,
    name: row.tenant_name,
    plan: row.tenant_plan,
  };
}

function mapUser(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    email: row.email,
    role: row.role,
  };
}

module.exports = {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createTenantUser,
  createSession,
  deleteTenantUser,
  deleteSession,
  getSessionUser,
  listTenantUsers,
  loginUser,
  registerTenantUser,
  updateTenantUser,
};
