const { getSessionUser, SESSION_COOKIE } = require("../server/auth-service");
const { ensureDatabase } = require("../server/bootstrap");
const { getDb } = require("../server/database");
const { parseCookies, readJson, sendJson } = require("../server/http-utils");
const {
  compareAiVsHuman,
  saveHumanScore,
  rubricCompliance,
} = require("../server/evaluation/research");
const { readRun } = require("../server/evaluation/trace-persister");
const {
  approveRun,
  listApprovals,
  processExpiredApprovals,
} = require("../server/evaluation/human-approval");
const { runExperiment } = require("../server/evaluation/benchmark/benchmark");

/**
 * Research API (admin only).
 *
 * GET  /api/research?action=metrics&assessmentId=...
 * GET  /api/research?action=runs&assessmentId=...
 * GET  /api/research?action=rubric&assessmentId=...
 * GET  /api/research?action=trace&runId=...
 * GET  /api/research?action=export&assessmentId=...
 * GET  /api/research?action=approvals&assessmentId=...
 * POST /api/research  { action:"save-human-score", payload:{ runId, humanScore, humanFeedback } }
 * POST /api/research  { action:"approve", payload:{ runId, humanScore?, humanFeedback? } }
 */
module.exports = async (req, res) => {
  try {
    await ensureDatabase();

    const auth = await getSessionUser(parseCookies(req)[SESSION_COOKIE]);
    if (!auth) return sendJson(res, 401, { error: "Unauthorized" });
    if (auth.user.role !== "admin") return sendJson(res, 403, { error: "Forbidden" });

    const url = new URL(req.url, `http://${req.headers.host}`);
    const tenantId = auth.tenant.id;

    if (req.method === "GET") {
      const action = url.searchParams.get("action");
      const assessmentId = url.searchParams.get("assessmentId") || url.searchParams.get("assessment_id");
      const runId = url.searchParams.get("runId") || url.searchParams.get("run_id");

      // PRD §24 — Run a benchmark experiment over a bundled dataset.
      if (action === "benchmark") {
        const dataset = url.searchParams.get("dataset") || "sample-bench-smoke";
        const modeParam = url.searchParams.get("mode");
        const mode = modeParam ? modeParam.split(",") : ["baseline", "harness"];
        const data = await runExperiment({ dataset, mode });
        return sendJson(res, 200, data);
      }

      // Eagerly sweep expired pending approvals so auto-approved runs have
      // already been written to evaluation_human_scores before any read.
      if (action !== "trace") {
        try {
          await processExpiredApprovals();
        } catch (err) {
          console.error("Sweep human approvals failed:", err);
        }
      }

      if (action === "metrics") {
        const data = await compareAiVsHuman(assessmentId, tenantId);
        return sendJson(res, 200, data);
      }
      if (action === "approvals") {
        const rows = await listApprovals({ tenantId, assessmentId, sweep: false });
        return sendJson(res, 200, { approvals: rows });
      }
      if (action === "runs") {
        const db = getDb();
        const rows = await db.all(
          `SELECT r.run_id, r.assessment_id, r.submission_id, r.model, r.final_score,
                  r.verification_valid, r.verification_status, r.created_at,
                  a.approval_status, a.deadline_at, h.human_score
             FROM evaluation_runs r
             LEFT JOIN human_approvals a ON a.run_id = r.run_id
             LEFT JOIN evaluation_human_scores h ON h.run_id = r.run_id
            WHERE r.tenant_id = ?
              AND ($2 IS NULL OR r.assessment_id = $2)
            ORDER BY datetime(r.created_at) DESC`,
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

      if (action === "approve") {
        if (!payload || !payload.runId) {
          return sendJson(res, 400, { error: "runId wajib" });
        }
        const result = await approveRun({
          runId: payload.runId,
          reviewerId: auth.user.id,
          humanScore: payload.humanScore,
          humanFeedback: payload.humanFeedback,
        });
        return sendJson(res, 200, result);
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