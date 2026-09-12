const { ensureDatabase } = require("../server/bootstrap");
const { readJson, sendJson } = require("../server/http-utils");
const { requireAuthenticatedRequest, requireRoles } = require("../server/http/request-security");
const research = require("../server/evaluation/research");

module.exports = async function researchApi(req, res) {
  try {
    await ensureDatabase();
    const security = await requireAuthenticatedRequest(req, res, {
      allowApiKey: false,
      csrf: req.method !== "GET",
    });
    if (!security) return;
    const { auth } = security;
    if (!requireRoles(res, auth, ["admin", "teacher"])) return;

    const url = new URL(req.url, `http://${req.headers.host}`);
    const action = url.searchParams.get("action");
    const assessmentId = url.searchParams.get("assessmentId") || null;

    if (req.method === "GET") {
      if (action === "metrics") return sendJson(res, 200, await research.compareAiVsHuman(assessmentId, auth.tenant.id));
      if (action === "rubric") return sendJson(res, 200, await research.rubricCompliance(assessmentId, auth.tenant.id));
      if (action === "calibration") return sendJson(res, 200, await research.compareCalibration(assessmentId, auth.tenant.id));
      if (action === "reliability") return sendJson(res, 200, await research.reliabilityDashboard(auth.tenant.id));
      if (action === "drift") return sendJson(res, 200, await research.detectDrift(auth.tenant.id));
      if (action === "repeatability") return sendJson(res, 200, await research.repeatabilitySummary(auth.tenant.id));
      if (action === "runs") {
        const db = require("../server/database").getDb();
        const rows = await db.all(
          `SELECT r.run_id, r.assessment_id, r.model, r.final_score,
                  r.harness_version, r.prompt_version, r.verification_status,
                  r.verification_valid, r.requires_human_review,
                  a.approval_status, h.human_score
             FROM evaluation_runs r
             LEFT JOIN human_approvals a ON a.run_id = r.run_id
             LEFT JOIN evaluation_human_scores h ON h.run_id = r.run_id
            WHERE r.tenant_id = ?
              AND (? IS NULL OR r.assessment_id = ?)
            ORDER BY r.created_at DESC`,
          auth.tenant.id,
          assessmentId,
          assessmentId
        );
        return sendJson(res, 200, { runs: rows });
      }
      if (action === "trace") {
        const runId = url.searchParams.get("runId");
        if (!runId) return sendJson(res, 400, { error: "Parameter runId wajib" });
        return sendJson(res, 200, await readTrace(runId, auth.tenant.id));
      }
      return sendJson(res, 404, { error: "Action not found" });
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      const payload = body.payload || {};
      if (!payload.runId) return sendJson(res, 400, { error: "runId wajib" });

      if (body.action === "save-human-score") {
        const score = Number(payload.humanScore);
        if (!Number.isFinite(score) || score < 0 || score > 100) {
          return sendJson(res, 400, { error: "Skor manusia harus angka 0-100" });
        }
        return sendJson(res, 200, await research.saveHumanScore({
          runId: payload.runId,
          humanScore: score,
          humanFeedback: payload.humanFeedback,
          reviewerId: auth.user.id,
        }));
      }

      if (body.action === "approve") {
        const { approveRun } = require("../server/evaluation/human-approval");
        return sendJson(res, 200, await approveRun({
          runId: payload.runId,
          reviewerId: auth.user.id,
          humanScore: payload.humanScore,
          humanFeedback: payload.humanFeedback,
        }));
      }
      return sendJson(res, 404, { error: "Action not found" });
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error("Research API Error:", error);
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};

async function readTrace(runId, tenantId) {
  const db = require("../server/database").getDb();
  const run = await db.get("SELECT * FROM evaluation_runs WHERE run_id = ? AND tenant_id = ?", runId, tenantId);
  if (!run) return { runId, available: false };
  const events = await db.all("SELECT type, data, ts FROM evaluation_events WHERE run_id = ? ORDER BY seq ASC", runId);
  const result = await db.get("SELECT * FROM evaluation_results WHERE run_id = ?", runId);
  const versions = await db.get("SELECT * FROM evaluation_versions WHERE run_id = ?", runId);
  return {
    runId,
    available: true,
    run,
    events: events.map((e) => ({ type: e.type, data: JSON.parse(e.data || "{}"), ts: e.ts })),
    result: result ? JSON.parse(result.result_json) : null,
    versions,
  };
}
