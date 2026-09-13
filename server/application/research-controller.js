const { ensureDatabase } = require("../bootstrap");
const { listEvaluationRuns, getEvaluationTrace } = require("../database/research-repository");
const { readJson, sendJson } = require("../http-utils");
const { requireAuthenticatedRequest, requireRoles } = require("../http/request-security");
const research = require("../evaluation/research");
const { approveRun } = require("../evaluation/human-approval");

module.exports = async function researchController(req, res) {
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
        const rows = await listEvaluationRuns(auth.tenant.id, assessmentId);
        return sendJson(res, 200, { runs: rows });
      }
      if (action === "trace") {
        const runId = url.searchParams.get("runId");
        if (!runId) return sendJson(res, 400, { error: "Parameter runId wajib" });
        return sendJson(res, 200, await getEvaluationTrace(runId, auth.tenant.id));
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
