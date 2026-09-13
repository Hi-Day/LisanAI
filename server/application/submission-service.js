const submissionGateway = require("../database/submission-gateway");

async function assertCanSubmit(auth, assessmentId) {
  return submissionGateway.assertCanSubmitAssessment(auth.tenant.id, auth.user.id, assessmentId);
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

module.exports = { assertCanSubmit, saveStudentSubmission, saveTeacherSubmission, getSubmission, saveComplaint };
