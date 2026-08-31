const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { createClient } = require("@libsql/client");
const { ROOT } = require("./config");
const { assertDatabaseContract } = require("./db/contract");

const DATA_DIR = path.join(ROOT, "data");

let db;
let libsqlClient;

function normalizeParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params;
}

function createLibsqlAdapter(client) {
  return assertDatabaseContract({
    async all(sql, ...params) {
      const rs = await client.execute({ sql, args: normalizeParams(params) });
      return rs.rows;
    },
    async get(sql, ...params) {
      const rs = await client.execute({ sql, args: normalizeParams(params) });
      return rs.rows[0];
    },
    async run(sql, ...params) {
      await client.execute({ sql: "PRAGMA foreign_keys = ON", args: [] });
      const rs = await client.execute({ sql, args: normalizeParams(params) });
      return { changes: rs.rowsAffected, lastInsertRowid: rs.lastInsertRowid };
    },
    async exec(sql) {
      await client.execute({ sql: "PRAGMA foreign_keys = ON", args: [] });
      await client.executeMultiple(sql);
    },
  });
}

async function initDatabase() {
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  if (!databaseUrl) throw new Error("Missing TURSO_DATABASE_URL");

  if (databaseUrl.startsWith("file:")) {
    if (process.env.VERCEL) {
      console.error("CRITICAL ERROR: Anda menjalankan Vercel tetapi belum mengatur TURSO_DATABASE_URL di Environment Variables!");
      throw new Error("Missing Turso configuration on Vercel");
    }
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  libsqlClient = createClient({
    url: databaseUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  db = createLibsqlAdapter(libsqlClient);
  await db.exec("PRAGMA foreign_keys = ON");
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
  await runFileMigrations();
  await ensureColumn("assessments", "tenant_id", "TEXT");
  await ensureColumn("assessments", "class_id", "TEXT");
  await ensureColumn("assessments", "teacher_id", "TEXT");
  await ensureColumn("assessments", "status", "TEXT DEFAULT 'published'");
  await ensureColumn("submissions", "tenant_id", "TEXT");
  await ensureColumn("submissions", "user_id", "TEXT");
  await ensureColumn("evaluation_runs", "input_hash", "TEXT");
  await ensureColumn("evaluation_runs", "rubric_hash", "TEXT");
  await ensureColumn("evaluation_runs", "prompt_hash", "TEXT");
  await ensureColumn("evaluation_runs", "config_hash", "TEXT");
  await ensureColumn("evaluation_runs", "published", "INTEGER");
  await ensureColumn("evaluation_runs", "requires_human_review", "INTEGER");
  await ensureColumn("evaluation_runs", "context_hash", "TEXT");
  await ensureColumn("evaluation_runs", "context_version", "TEXT");
  await ensureColumn("evaluation_runs", "risk_score", "REAL");
  await ensureColumn("evaluation_runs", "risk_level", "TEXT");
  await ensureColumn("evaluation_runs", "policy_applied", "TEXT");
  await ensureColumn("ai_logs", "run_id", "TEXT");
  await ensureColumn("evaluation_contexts", "expires_at", "TEXT");
}

function getDb() {
  if (!db) throw new Error("Database belum siap");
  return db;
}

async function ensureColumn(table, column, type) {
  const columns = await db.all(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

async function recordMigration(version, name) {
  await db.run("INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)", version, name, new Date().toISOString());
}

async function runFileMigrations() {
  const migrationsDir = path.join(__dirname, "migrations");
  if (!fs.existsSync(migrationsDir)) return;
  const files = fs.readdirSync(migrationsDir).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
  for (const file of files) {
    const version = Number(file.split("_")[0]);
    const existing = await db.get("SELECT version FROM schema_migrations WHERE version = ?", version);
    if (existing) continue;
    await db.exec(fs.readFileSync(path.join(migrationsDir, file), "utf8"));
    await recordMigration(version, file.replace(/\.sql$/, ""));
  }
}

module.exports = { getDb, initDatabase, ensureColumn, recordMigration, runFileMigrations, createLibsqlAdapter };
