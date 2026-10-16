const submissionGateway = require("../database/submission-gateway");

async function assertCanSubmit(auth, assessmentId, classId = null) {
  return submissionGateway.assertCanSubmitAssessment(auth.tenant.id, auth.user.id, assessmentId, classId);
}

async function saveStudentSubmission(auth, submission) {
  return submissionGateway.saveStudentSubmission(auth.tenant.id, auth.user.id, submission);
}

async function saveTeacherSubmission(auth, submission) {
  const existing = await submissionGateway.getSubmissionForUpdate(auth, submission.id);
  await submissionGateway.saveTeacherSubmission(auth.tenant.id, existing.user_id, submission);
  return existing;
}

async function getSubmission(auth, submissionId) {
  return submissionGateway.getSubmissionDetail(auth, submissionId);
}

async function saveComplaint(auth, submissionId, questionIndex, reason) {
  return submissionGateway.saveComplaint(auth, submissionId, questionIndex, reason);
}

async function createAssessmentAttempt(auth, assessmentId, classId = null, idempotencyKey = null) {
  if (auth.user.role !== "student") throw Object.assign(new Error("Hanya siswa yang dapat memulai assessment"), { status: 403 });
  return submissionGateway.createAssessmentAttempt(auth, assessmentId, classId, idempotencyKey);
}

async function getAssessmentAttempt(auth, attemptId) {
  if (auth.user.role !== "student") throw Object.assign(new Error("Hanya siswa yang dapat mengambil attempt"), { status: 403 });
  return submissionGateway.getAssessmentAttempt(auth, attemptId);
}

async function beginAttemptEvaluation(auth, attemptId, answers, assessmentId) {
  if (auth.user.role !== "student") throw Object.assign(new Error("Hanya siswa yang dapat mengevaluasi attempt"), { status: 403 });
  return submissionGateway.beginAttemptEvaluation(auth, attemptId, answers, assessmentId);
}

async function saveEvaluatedSubmission(auth, submission) {
  return submissionGateway.saveEvaluatedSubmission(auth, submission);
}

async function releaseAttemptEvaluation(auth, attemptId) {
  return submissionGateway.releaseAttemptEvaluation(auth, attemptId);
}

async function finalizeAssessmentAttempt(auth, attemptId, submission, hashes) {
  if (auth.user.role !== "student") throw Object.assign(new Error("Hanya siswa yang dapat menyelesaikan attempt"), { status: 403 });
  return submissionGateway.finalizeAssessmentAttempt(auth, attemptId, submission, hashes);
}

async function getCanonicalAssessmentForStudent(auth, assessmentId, classId = null) {
  if (auth.user.role !== "student") throw Object.assign(new Error("Hanya siswa yang dapat mengambil snapshot assessment"), { status: 403 });
  return submissionGateway.getCanonicalAssessmentForStudent(auth, assessmentId, classId);
}

const MAX_AUDIO_CHARS = 3_000_000;
const MAX_QUESTION_INDEX = 100;

async function saveSubmissionAudio(auth, patch = {}) {
  const { id, index, kind, audio } = patch || {};
  if (typeof id !== "string" || !id.trim()) {
    throw Object.assign(new Error("ID submission wajib diisi"), { status: 400 });
  }
  if (!Number.isInteger(index) || index < 0 || index > MAX_QUESTION_INDEX) {
    throw Object.assign(new Error("Indeks soal tidak valid"), { status: 400 });
  }
  if (typeof audio !== "string" || !audio.startsWith("data:audio/") || audio.length > MAX_AUDIO_CHARS) {
    throw Object.assign(new Error("Data audio tidak valid atau terlalu besar"), { status: 400 });
  }

  const payload = await submissionGateway.getSubmissionDetail(auth, id);
  if (!Array.isArray(payload.questionScores) || !payload.questionScores[index]) {
    throw Object.assign(new Error("Soal tidak ditemukan"), { status: 404 });
  }

  // Students may only patch their own submission; the repository adds the
  // user_id clause as defense-in-depth on top of the gateway's ownership check.
  const options = auth.user.role === "student" ? { userId: auth.user.id } : {};
  await submissionGateway.updateSubmissionAudio(auth, id, { index, kind }, audio, options);
  return { ok: true };
}

module.exports = { assertCanSubmit, saveStudentSubmission, saveTeacherSubmission, saveEvaluatedSubmission, releaseAttemptEvaluation, getSubmission, saveComplaint, saveSubmissionAudio, createAssessmentAttempt, getAssessmentAttempt, beginAttemptEvaluation, finalizeAssessmentAttempt, getCanonicalAssessmentForStudent };
