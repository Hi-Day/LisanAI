const databaseHandler = require("./database");

/**
 * Data API boundary.
 *
 * This endpoint intentionally reuses the existing database handler during the
 * incremental refactor. Domain extraction can happen behind this stable
 * deployment boundary without increasing the number of Vercel functions.
 */
module.exports = async (req, res) => databaseHandler(req, res);
