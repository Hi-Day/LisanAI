const { getSessionUser, SESSION_COOKIE } = require("../server/auth-service");
const { getDb, initDatabase } = require("../server/database");
const { parseCookies, readJson, sendJson } = require("../server/http-utils");
const {
  compareAiVsHuman,
  saveHumanScore,
  rubricCompliance,
} = require("../server/evaluation/research");
const { readRun } = require("../server/evaluation/trace-persister");

let isDbInitialized = false;

/**
 * Research API (admin only).
 *
 * GET  /api/research?action=metrics&assessmentId=...
 * GET  /api/research?action=runs&assessmentId=...
 * GET  /api/research?action=rubric&assessmentId=...
 * GET  /api/research?action=trace&runId=...
 * GET  /api/research?action=export&assessmentId=...
 * POST /api/research  { action:"save-human-score", payload:{ runId, humanScore, humanFeedback } }
 */
module.exports = async (req, res) => {
  try {
    if (!isDbInitialized) {
      await initDatabase();
      isDbInitialized = true;
    }

    const auth = await getSessionUser(parseCookies(req)[SESSION_COOKIE]);
    if (!auth) return sendJson(res, 401, { error: "Unauthorized" });
    if (auth.user.role !== "admin") return sendJson(res, 403, { error: "Forbidden" });

    const url = new URL(req.url, `http://${req.headers.host}`);
    const tenantId = auth.tenant.id;

    if (req.method === "GET") {
      const action = url.searchParams.get("action");
      const assessmentId = url.searchParams.get("assessmentId") || url.searchParams.get("assessment_id");
      const runId = url.searchParams.get("runId") || url.searchParams.get("run_id");

      if (action === "metrics") {
        const data = await compareAiVsHuman(assessmentId, tenantId);
        return sendJson(res, 200, data);
      }
      if (action === "runs") {
        const db = getDb();
        const rows = await db.all(
          `SELECT run_id, assessment_id, submission_id, model, final_score,
                  verification_valid, created_at
             FROM evaluation_runs
            WHERE tenant_id = ?
              AND ($2 IS NULL OR assessment_id = $2)
            ORDER BY datetime(created_at) DESC`,
          tenantId,
          assessmentId || null
        );
        return sendJson(res, 200, { runs: rows });
      }
      if (action === "rubric") {
        const data = await rubricCompliance(assessmentId, tenantId);
        return sendJson(res, 200, data);
      }
      if (action === "trace") {
        if (!runId) return sendJson(res, 400, { error: "runId wajib" });
        const run = await readRun(runId);
        if (!run.available) return sendJson(res, 404, { error: "Trace tidak ditemukan" });
        return sendJson(res, 200, run);
      }
      if (action === "export") {
        const data = await exportTraceBundle(assessmentId, tenantId);
        return sendJson(res, 200, data);
      }
      return sendJson(res, 404, { error: "Action not found" });
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      const action = body.action;
      const payload = body.payload || {};

      if (action === "save-human-score") {
        const saved = await saveHumanScore({
          ...payload,
          reviewerId: auth.user.id,
          tenantId,
        });
        return sendJson(res, 200, saved);
      }
      return sendJson(res, 404, { error: "Action not found" });
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};

/**
 * Export a full reproducible bundle of evaluation runs for a tenant/assessment,
 * including everything needed to reconstruct the research experiment.
 */
async function exportTraceBundle(assessmentId, tenantId) {
  const db = getDb();
  const runs = await db.all(
    `SELECT run_id, assessment_id, submission_id, model, prompt_version, rubric_version,
            harness_version, engine_version, final_score, verification_valid, verification_issues, created_at
       FROM evaluation_runs
      WHERE tenant_id = $1 AND ($2 IS NULL OR assessment_id = $2)
      ORDER BY datetime(created_at) ASC`,
    tenantId,
    assessmentId || null
  );
  const out = [];
  for (const run of runs) {
    const detail = await readRun(run.run_id);
    if (detail.available) {
      const human = await getDb().get(
        "SELECT human_score, human_feedback, reviewed_at, reviewer_id FROM evaluation_human_scores WHERE run_id = ?",
        run.run_id
      );
      detail.human = human || null;
    }
    out.push(detail);
  }
  return {
    exportedAt: new Date().toISOString(),
    assessmentId: assessmentId || null,
    tenantId,
    count: out.length,
    runs: out,
  };
}