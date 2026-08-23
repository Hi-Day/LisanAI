const crypto = require("node:crypto");
const { getDb } = require("./database");

const KEY_PREFIX = "lsk_"; // Lisan Secret Key

function uid(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function hashKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Generate a new API key for a tenant.
 * Returns the plaintext key (shown once) and the stored record.
 */
async function createApiKey(tenantId, { name, createdBy }) {
  const rawKey = `${KEY_PREFIX}${crypto.randomBytes(24).toString("base64url")}`;
  const record = {
    id: uid("apikey"),
    tenantId,
    name: String(name || "API Key").trim(),
    keyHash: hashKey(rawKey),
    prefix: rawKey.slice(0, 12),
    createdBy: createdBy || null,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    revokedAt: null,
  };

  await getDb().run(
    `INSERT INTO api_keys (id, tenant_id, name, key_hash, prefix, created_by, created_at, last_used_at, revoked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    record.id,
    record.tenantId,
    record.name,
    record.keyHash,
    record.prefix,
    record.createdBy,
    record.createdAt,
    record.lastUsedAt,
    record.revokedAt
  );

  return { rawKey, record };
}

/**
 * List active (non-revoked) API keys for a tenant.
 */
async function listApiKeys(tenantId) {
  const rows = await getDb().all(
    `SELECT id, tenant_id, name, prefix, created_by, created_at, last_used_at, revoked_at
     FROM api_keys WHERE tenant_id = ? AND revoked_at IS NULL ORDER BY created_at DESC`,
    tenantId
  );
  return rows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    prefix: row.prefix,
    createdBy: row.created_by,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
  }));
}

/**
 * Revoke an API key (soft delete via revoked_at).
 */
async function revokeApiKey(tenantId, keyId) {
  const result = await getDb().run(
    "UPDATE api_keys SET revoked_at = ? WHERE id = ? AND tenant_id = ? AND revoked_at IS NULL",
    new Date().toISOString(),
    keyId,
    tenantId
  );
  if (!result.changes) {
    throw Object.assign(new Error("API key tidak ditemukan"), { status: 404 });
  }
  return { ok: true };
}

/**
 * Resolve an API key to a tenant. Returns null if invalid/revoked.
 * Updates last_used_at on success.
 */
async function resolveApiKey(rawKey) {
  if (!rawKey || !rawKey.startsWith(KEY_PREFIX)) return null;
  const keyHash = hashKey(rawKey);
  const row = await getDb().get(
    `SELECT id, tenant_id, revoked_at FROM api_keys WHERE key_hash = ?`,
    keyHash
  );
  if (!row || row.revoked_at) return null;

  // Update last_used_at (best-effort, non-blocking).
  await getDb().run(
    "UPDATE api_keys SET last_used_at = ? WHERE id = ?",
    new Date().toISOString(),
    row.id
  ).catch(() => {});

  return { keyId: row.id, tenantId: row.tenant_id };
}

module.exports = {
  KEY_PREFIX,
  createApiKey,
  listApiKeys,
  revokeApiKey,
  resolveApiKey,
  hashKey,
};