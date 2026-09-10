const { initDatabase } = require("./database");

let dbPromise = null;

/**
 * Initialize the database exactly once and share the in-flight promise across
 * every API handler. Showcase/demo provisioning is intentionally NOT part of
 * database startup: doing a large demo seed inside the first request can make
 * Vercel serverless requests time out and surface in the browser as
 * "Failed to fetch". The showcase bootstrap is triggered lazily by the
 * authenticated state endpoint instead.
 */
async function ensureDatabase() {
  if (!dbPromise) {
    dbPromise = initDatabase().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

module.exports = { ensureDatabase };
