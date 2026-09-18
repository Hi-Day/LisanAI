const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const DB_FILE = path.join(os.tmpdir(), `oralai-migrations-${Date.now()}.db`);
process.env.TURSO_DATABASE_URL = `file:${DB_FILE}`;

const { initDatabase, getDb, runFileMigrations } = require("../server/database/client");

const MIGRATIONS_DIR = path.join(__dirname, "..", "server", "migrations");

test.before(async () => {
  await initDatabase();
});

test.after(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    const file = `${DB_FILE}${suffix}`;
    if (fs.existsSync(file)) fs.rmSync(file, { force: true });
  }
});

test("fresh apply records one row per migration file", async () => {
  const db = getDb();
  const expectedFiles = fs.readdirSync(MIGRATIONS_DIR).filter((file) => /^\d+_.+\.sql$/.test(file));
  const rows = await db.all("SELECT version FROM schema_migrations");
  assert.equal(rows.length, expectedFiles.length);

  const contexts = await db.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'evaluation_contexts'");
  assert.equal(contexts.length, 1);
});

test("re-running file migrations is a no-op", async () => {
  const db = getDb();
  const before = await db.all("SELECT version FROM schema_migrations");
  await runFileMigrations();
  const after = await db.all("SELECT version FROM schema_migrations");
  assert.equal(after.length, before.length);
});

test("a mid-file failure leaves no partial DDL and no version record", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oralai-migrations-broken-"));
  const brokenPath = path.join(tmpDir, "101_atomic_broken.sql");
  try {
    fs.writeFileSync(path.join(tmpDir, "100_atomic_ok.sql"), "CREATE TABLE widgets (id TEXT PRIMARY KEY);");
    fs.writeFileSync(
      brokenPath,
      "CREATE TABLE gadgets (id TEXT PRIMARY KEY);\nINSERT INTO table_that_does_not_exist (id) VALUES ('x');",
    );

    await assert.rejects(() => runFileMigrations(tmpDir));

    const db = getDb();

    // Per-file atomicity: the preceding file committed fully.
    const widgets = await db.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'widgets'");
    assert.equal(widgets.length, 1);
    assert.ok(await db.get("SELECT version FROM schema_migrations WHERE version = ?", 100));

    // Mid-file failure: the broken file's DDL rolled back and it is not recorded.
    const gadgets = await db.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'gadgets'");
    assert.equal(gadgets.length, 0);
    assert.equal(await db.get("SELECT version FROM schema_migrations WHERE version = ?", 101), undefined);

    // Once fixed, the same file applies and is recorded.
    fs.writeFileSync(brokenPath, "CREATE TABLE gadgets (id TEXT PRIMARY KEY);");
    await runFileMigrations(tmpDir);
    const fixedGadgets = await db.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'gadgets'");
    assert.equal(fixedGadgets.length, 1);
    assert.ok(await db.get("SELECT version FROM schema_migrations WHERE version = ?", 101));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
