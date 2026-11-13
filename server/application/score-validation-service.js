const submissionGateway = require("../database/submission-gateway");
const { isScoreReleased, releasedBy } = require("../score-release");
const { approveRun } = require("../evaluation/human-approval");
const { enqueueOutcomeForSubmission, processOutcomeOutbox } = require("../lti");

const MAX_BATCH = 200;

function validationError(message, status = 400, code = null) {
  return Object.assign(new Error(message), { status, ...(code ? { code } : {}) });
}

function parsePayload(row) {
  try { return JSON.parse(row.payload || "{}"); } catch { throw validationError("Data submission rusak", 422); }
}

/**
 * Lecturer validates AI scores: the submission becomes final, the score is released to the
 * student, the approval is recorded for research, and the score is queued for LTI passback.
 * Authorization per submission reuses getSubmissionForUpdate (teacher must own the class).
 */
async function validateScores(auth, submissionIds) {
  if (!["teacher", "admin"].includes(auth?.user?.role)) throw validationError("Forbidden", 403);
  const ids = [...new Set((Array.isArray(submissionIds) ? submissionIds : []).map((id) => String(id || "").trim()).filter(Boolean))];
  if (!ids.length) throw validationError("Pilih minimal satu submission untuk divalidasi");
  if (ids.length > MAX_BATCH) throw validationError(`Maksimal ${MAX_BATCH} submission per validasi`);

  const validated = [];
  const alreadyValidated = [];
  const invalid = [];
  let queuedForLms = 0;

  for (const id of ids) {
    const row = await submissionGateway.getSubmissionForUpdate(auth, id);
    const submission = parsePayload(row);
    if (isScoreReleased(submission)) {
      alreadyValidated.push(id);
      continue;
    }
    const score = Number(submission.finalScore);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      // One bad row must not hide the result of the rows already released in this batch.
      invalid.push({ id, message: "Nilai tidak valid; koreksi nilai sebelum validasi" });
      continue;
    }

    const release = { ...releasedBy(auth.user.id), previousStatus: submission.status || null };
    const finalized = { ...submission, status: "EVALUATED", scoreRelease: release };
    await submissionGateway.saveTeacherSubmission(auth.tenant.id, row.user_id, finalized);
    validated.push(id);

    if (finalized.evaluationRunId) {
      // Research traceability must not block the release of an already-validated score.
      // source "validation": releasing a score is not an independent human rating.
      await approveRun({ runId: finalized.evaluationRunId, tenantId: auth.tenant.id, reviewerId: auth.user.id, humanScore: score, source: "validation" })
        .catch((error) => console.error("[score-validation] human approval record failed:", error.message));
    }

    if (row.user_id && row.assessment_id) {
      const outcome = await enqueueOutcomeForSubmission({
        tenantId: auth.tenant.id,
        userId: row.user_id,
        assessmentId: row.assessment_id,
        submissionId: id,
        score,
      });
      queuedForLms += outcome.queued || 0;
    }
  }

  if (invalid.length && !validated.length && !alreadyValidated.length) {
    throw validationError(`Nilai submission ${invalid[0].id} tidak valid; koreksi nilai sebelum validasi`, 422, "INVALID_SCORE");
  }

  // Deliver now; failures stay in the durable outbox and are retried on later requests.
  let lmsDelivery = null;
  if (queuedForLms) {
    lmsDelivery = await processOutcomeOutbox({ limit: Math.min(queuedForLms + 10, 100) })
      .catch((error) => ({ error: error.message }));
  }

  return { validated, alreadyValidated, invalid, queuedForLms, lmsDelivery };
}

/** A score corrected after its release is queued for the LMS again, so both systems agree. */
async function resyncReleasedScore(auth, row, previous, saved) {
  const score = Number(saved?.finalScore);
  if (!isScoreReleased(saved) || !Number.isFinite(score) || score === Number(previous?.finalScore)) return null;
  if (!row?.user_id || !row?.assessment_id) return null;
  const outcome = await enqueueOutcomeForSubmission({
    tenantId: auth.tenant.id,
    userId: row.user_id,
    assessmentId: row.assessment_id,
    submissionId: saved.id,
    score,
  });
  if (outcome.queued) await processOutcomeOutbox({ limit: 10 });
  return outcome;
}

module.exports = { validateScores, resyncReleasedScore, MAX_BATCH };
