const { initDatabase } = require("./database");
const { ensureShowcaseDemo } = require("./showcase-bootstrap");

let dbPromise = null;

/**
 * Initialize the database exactly once and share the in-flight promise across
 * every API handler, replacing the duplicated `isDbInitialized` guards.
 */
async function ensureDatabase() {
  if (!dbPromise) {
    dbPromise = initDatabase()
      .then(async () => {
        await ensureShowcaseDemo();
      })
      .catch((error) => {
        dbPromise = null;
        throw error;
      });
  }
  return dbPromise;
}

module.exports = { ensureDatabase };
