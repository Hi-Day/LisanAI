const { getDb } = require("./client");
const repository = require("./submission-repository");

module.exports = {
  assertCanSubmitAssessment: (tenantId, userId, assessmentId) =>
    repository.assertCanSubmitAssessment(getDb(), tenantId, userId, assessmentId),
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
};
