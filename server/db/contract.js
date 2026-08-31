/**
 * Database contract consumed by application/domain services.
 *
 * Implementations may be libSQL/SQLite today or PostgreSQL later. Keeping this
 * contract deliberately small prevents provider-specific APIs leaking upward.
 */
function assertDatabaseContract(db) {
  const required = ["all", "get", "run", "exec"];
  for (const method of required) {
    if (!db || typeof db[method] !== "function") {
      throw new TypeError(`Database adapter missing method: ${method}`);
    }
  }
  return db;
}

module.exports = { assertDatabaseContract };
