const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@libsql/client");
const { ROOT } = require("../config");

const DATA_DIR = path.join(ROOT, "data");
let db;
let libsqlClient;

function normalizeParams(params) {
  return params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
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

  libsqlClient = createClient({ url: databaseUrl, authToken: process.env.TURSO_AUTH_TOKEN });
  db = {
    async all(sql, ...params) {
      const rs = await libsqlClient.execute({ sql, args: normalizeParams(params) });
      return rs.rows;
    },
    async get(sql, ...params) {
      const rs = await libsqlClient.execute({ sql, args: normalizeParams(params) });
      return rs.rows[0];
    },
    async run(sql, ...params) {
      await libsqlClient.execute({ sql: "PRAGMA foreign_keys = ON", args: [] });
      const rs = await libsqlClient.execute({ sql, args: normalizeParams(params) });
      return { changes: rs.rowsAffected, lastInsertRowid: rs.lastInsertRowid };
    },
    async exec(sql) {
      await libsqlClient.execute({ sql: "PRAGMA foreign_keys = ON", args: [] });
      await libsqlClient.executeMultiple(sql);
    },
  };

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

// Split a SQL script into individual statements on top-level semicolons.
// Quoted strings/identifiers are respected ('...' with '' escapes, "..." with
// "" escapes). `--` line comments are stripped; `/* */` block comments are
// preserved inline. Empty/whitespace-only statements are dropped.
function splitSqlStatements(sql) {
  const statements = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      if (char === "\n") inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      current += char;
      if (char === "*" && next === "/") {
        current += next;
        i += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (inSingle) {
      current += char;
      if (char === "'") {
        if (next === "'") {
          current += next;
          i += 1;
        } else {
          inSingle = false;
        }
      }
      continue;
    }

    if (inDouble) {
      current += char;
      if (char === '"') {
        if (next === '"') {
          current += next;
          i += 1;
        } else {
          inDouble = false;
        }
      }
      continue;
    }

    if (char === "-" && next === "-") {
      inLineComment = true;
      i += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      current += char + next;
      i += 1;
      inBlockComment = true;
      continue;
    }

    if (char === "'") {
      inSingle = true;
      current += char;
      continue;
    }

    if (char === '"') {
      inDouble = true;
      current += char;
      continue;
    }

    if (char === ";") {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = "";
      continue;
    }

    current += char;
  }

  const trailing = current.trim();
  if (trailing) statements.push(trailing);
  return statements;
}

async function runFileMigrations(migrationsDir = path.join(__dirname, "..", "migrations")) {
  if (!fs.existsSync(migrationsDir)) return;
  const files = fs.readdirSync(migrationsDir).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
  for (const file of files) {
    const version = Number(file.split("_")[0]);
    const name = file.replace(/\.sql$/, "");
    const existing = await db.get("SELECT version FROM schema_migrations WHERE version = ?", version);
    if (existing) continue;

    // Apply the migration DDL and record its version in one atomic libSQL batch,
    // so a mid-file failure leaves neither partial schema nor a version record.
    const batch = splitSqlStatements(fs.readFileSync(path.join(migrationsDir, file), "utf8")).map((sql) => ({ sql, args: [] }));
    batch.push({
      sql: "INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
      args: [version, name, new Date().toISOString()],
    });
    await libsqlClient.batch(batch, "write");
  }
}

module.exports = { initDatabase, getDb, runFileMigrations, splitSqlStatements };
