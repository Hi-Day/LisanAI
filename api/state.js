// Lightweight read-only state endpoint used by the frontend (src/js/api.js).
// Created to match commit 4c8c6f2 which switched loadStateFromDatabase()
// from /api/database?action=state to GET /api/state without adding the handler.
const { getDb, getState } = require("../server/database");
const { ensureDatabase } = require("../server/bootstrap");
const { sendJson } = require("../server/http-utils");
const { requireAuthenticatedRequest } = require("../server/http/request-security");
const { getHarnessReadiness } = require("../server/harness/harness-evaluator");

function requestPath(req) {
  return String(req.url || "").split("?")[0];
}

// Authenticated readiness probe (see docs/OPERATIONS.md). Runs a real query
// against the database and reports harness readiness without network calls or
// secrets. Internal error details are never exposed beyond a short message.
async function buildHealthPayload() {
  let database;
  try {
    const row = await getDb().get("SELECT 1 AS ok");
    database = Number(row && row.ok) === 1 ? { ok: true } : { ok: false, error: "Pemeriksaan database gagal" };
  } catch (error) {
    database = { ok: false, error: "Pemeriksaan database gagal" };
  }
  return {
    status: database.ok ? "ok" : "error",
    database,
    harness: getHarnessReadiness(),
    timestamp: new Date().toISOString(),
  };
}

module.exports = async (req, res) => {
  try {
    await ensureDatabase();
    if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
    const security = await requireAuthenticatedRequest(req, res, { allowApiKey: false, csrf: false });
    if (!security) return;
    if (requestPath(req) === "/api/health") {
      const payload = await buildHealthPayload();
      return sendJson(res, payload.status === "ok" ? 200 : 503, payload);
    }
    return sendJson(res, 200, await getState(security.auth));
  } catch (error) {
    console.error(error);
    if (requestPath(req) === "/api/health") {
      return sendJson(res, 503, {
        status: "error",
        database: { ok: false, error: "Pemeriksaan database gagal" },
        harness: getHarnessReadiness(),
        timestamp: new Date().toISOString(),
      });
    }
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};
