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
  markHumanReviewed,
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
 *   → saves the human score AND marks the approval `human_reviewed` so the
 *     7-day auto-approval sweep never overwrites it with the AI score.
 * POST /api/research  { action:"approve", payload:{ runId, humanScore?, humanFeedback? } }
 */
module.exports = async (req, res) => {
  try {
    await ensureDatabase();

    const auth = await getSessionUser(parseCookies(req)[SESSION_COOKIE]);
    if (!auth) return sendJson(res, 401, { error: "Unauthorized" });

    const isAdmin = auth.user.role === "admin";
    const isTeacher = auth.user.role === "teacher";
    if (!isAdmin && !isTeacher) return sendJson(res, 403, { error: "Forbidden" });

    const url = new URL(req.url, `http://${req.headers.host}`);
    const tenantId = auth.tenant.id;

    if (req.method === "GET") {
      const action = url.searchParams.get("action");
      const assessmentId = url.searchParams.get("assessmentId") || url.searchParams.get("assessment_id");
      const runId = url.searchParams.get("runId") || url.searchParams.get("run_id");

      // Teachers get read-only diagnostic access (Assessment Trace on the
      // assessment detail page). All other research/metrics actions stay admin-only.
      if (isTeacher) {
        if (action !== "trace") return sendJson(res, 403, { error: "Forbidden" });
        return handleTeacherTrace(req, res, auth, tenantId, runId);
      }

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
        // Inter-rater reliability (PRD §33): Cohen's κ, weighted κ, ICC.
        if (data && data.n > 0) {
          const {
            interRaterMetrics,
            iccTwoWay,
          } = require("../server/evaluation/metrics");
          const ai = data.rows.map((r) => r.aiScore);
          const human = data.rows.map((r) => r.humanScore);
          const inter = interRaterMetrics(ai, human);
          const icc = iccTwoWay([ai, human]);
          data.interRater = {
            n: data.n,
            cohensKappa: Number.isNaN(inter.cohensKappa) ? null : inter.cohensKappa,
            weightedKappa: Number.isNaN(inter.weightedKappa) ? null : inter.weightedKappa,
            icc: Number.isNaN(icc.icc) ? null : icc.icc,
          };
        }
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
                  r.harness_version, r.prompt_version, r.rubric_version, r.input_hash, r.prompt_hash, r.rubric_hash,
                  a.approval_status, a.deadline_at, h.human_score
             FROM evaluation_runs r
             LEFT JOIN human_approvals a ON a.run_id = r.run_id
             LEFT JOIN evaluation_human_scores h ON h.run_id = r.run_id
            WHERE r.tenant_id = ?
              AND ($2 IS NULL OR r.assessment_id = $2)
            ORDER BY datetime(r.created_at) DESC
            LIMIT 200`,
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
        // Mark the approval as explicitly reviewed by a human so the 7-day
        // auto-approval sweep never overwrites the correction with the AI score.
        const approval = await markHumanReviewed({
          runId: payload.runId,
          reviewerId: auth.user.id,
        });
        return sendJson(res, 200, {
          ...saved,
          approvalStatus: approval?.approval_status || "human_reviewed",
        });
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

/**
 * Teacher read-only trace access (Assessment Detail → Assessment Trace).
 * A teacher may only read traces of runs whose assessment belongs to a class
 * they own, within their own tenant.
 */
async function handleTeacherTrace(req, res, auth, tenantId, runId) {
  if (!runId) return sendJson(res, 400, { error: "runId wajib" });
  const run = await readRun(runId);
  if (!run.available) return sendJson(res, 404, { error: "Trace tidak ditemukan" });
  if (run.run && run.run.tenant_id && run.run.tenant_id !== tenantId) {
    return sendJson(res, 403, { error: "Forbidden" });
  }
  const db = getDb();
  const assessmentId = run.run ? run.run.assessment_id : null;
  if (assessmentId) {
    const assessment = await db.get(
      "SELECT class_id FROM assessments WHERE id = ? AND tenant_id = ?",
      assessmentId,
      tenantId
    );
    if (!assessment) return sendJson(res, 403, { error: "Forbidden" });
    const classroom = await db.get(
      "SELECT teacher_id FROM classes WHERE id = ? AND tenant_id = ?",
      assessment.class_id,
      tenantId
    );
    if (!classroom || classroom.teacher_id !== auth.user.id) {
      return sendJson(res, 403, { error: "Forbidden" });
    }
  }
  return sendJson(res, 200, run);
}