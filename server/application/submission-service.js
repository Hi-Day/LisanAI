const submissionRepository = require("../database/submission-repository");

async function assertCanSubmit(auth, assessmentId) {
  return submissionRepository.assertCanSubmitAssessment(
    require("../database/client").getDb(),
    auth.tenant.id,
    auth.user.id,
    assessmentId,
  );
}

async function saveStudentSubmission(auth, submission) {
  return submissionRepository.saveSubmission(
    require("../database/client").getDb(),
    auth.tenant.id,
    auth.user.id,
    submission,
  );
}

async function saveTeacherSubmission(auth, submission) {
  const existing = await submissionRepository.getSubmissionForUpdate(
    require("../database/client").getDb(), auth, submission.id,
  );
  return submissionRepository.saveSubmission(
    require("../database/client").getDb(),
    auth.tenant.id,
    existing.user_id,
    submission,
    true,
  );
}

async function getSubmission(auth, submissionId) {
  return submissionRepository.getSubmissionDetail(
    require("../database/client").getDb(), auth, submissionId,
  );
}

async function saveComplaint(auth, submissionId, questionIndex, reason) {
  return submissionRepository.saveComplaint(
    require("../database/client").getDb(), auth, submissionId, questionIndex, reason,
  );
}

module.exports = { assertCanSubmit, saveStudentSubmission, saveTeacherSubmission, getSubmission, saveComplaint };
