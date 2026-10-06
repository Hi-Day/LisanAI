const { getDb } = require("./client");
const repository = require("./submission-repository");

module.exports = {
  assertCanSubmitAssessment: (tenantId, userId, assessmentId, classId = null) =>
    repository.assertCanSubmitAssessment(getDb(), tenantId, userId, assessmentId, classId),
  saveStudentSubmission: (tenantId, userId, submission) =>
    repository.saveSubmission(getDb(), tenantId, userId, submission),
  getSubmissionForUpdate: (auth, submissionId) =>
    repository.getSubmissionForUpdate(getDb(), auth, submissionId),
  saveTeacherSubmission: (tenantId, userId, submission) =>
    repository.saveSubmission(getDb(), tenantId, userId, submission, true),
  getSubmissionDetail: (auth, submissionId) =>
    repository.getSubmissionDetail(getDb(), auth, submissionId),
  saveComplaint: (auth, submissionId, questionIndex, reason) =>
    repository.saveComplaint(getDb(), auth, submissionId, questionIndex, reason),
  updateSubmissionAudio: (auth, submissionId, target, audio, options) =>
    repository.updateSubmissionAudio(getDb(), auth.tenant.id, submissionId, target, audio, options),
  createAssessmentAttempt: (auth, assessmentId, classId, idempotencyKey) =>
    repository.createAssessmentAttempt(getDb(), auth, assessmentId, classId, idempotencyKey),
  getAssessmentAttempt: (auth, attemptId) =>
    repository.getAssessmentAttempt(getDb(), auth, attemptId),
  beginAttemptEvaluation: (auth, attemptId, answers, assessmentId) =>
    repository.beginAttemptEvaluation(getDb(), auth, attemptId, answers, assessmentId),
  finalizeAssessmentAttempt: (auth, attemptId, submission, hashes) =>
    repository.finalizeAssessmentAttempt(getDb(), auth, attemptId, submission, hashes),
  getCanonicalAssessmentForStudent: (auth, assessmentId, classId) =>
    repository.getCanonicalAssessmentForStudent(getDb(), auth.tenant.id, auth.user.id, assessmentId, classId),
};
