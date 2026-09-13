const { initDatabase, getDb } = require("./database/client");
const assessment = require("./database/assessment-repository");
const submission = require("./database/submission-repository");
const classroom = require("./database/classroom-repository");
const membership = require("./database/membership-repository");
const questionBank = require("./database/question-bank-repository");

async function getState(auth) {
  const db = getDb();
  const assessments = await assessment.getVisibleAssessments(db, auth);
  const submissions = await submission.getVisibleSubmissions(db, auth);
  const classes = await classroom.getVisibleClasses(db, auth);
  const memberships = await membership.getVisibleMemberships(db, auth);
  const studentView = auth.user.role === "student";
  return {
    assessments: assessments.map((row) => assessment.sanitizeAssessmentForRole(JSON.parse(row.payload), studentView)),
    submissions: submissions.map((row) => submission.stripSubmissionAudio(JSON.parse(row.payload))),
    classes,
    memberships,
  };
}

module.exports = {
  clearData: (tenantId) => classroom.clearData(getDb(), tenantId),
  approveMembership: (tenantId, teacherId, membershipId) => membership.approveMembership(getDb(), tenantId, teacherId, membershipId),
  createClass: (tenantId, teacherId, classroomData) => classroom.createClass(getDb(), tenantId, teacherId, classroomData),
  deleteAssessment: (auth, assessmentId) => assessment.deleteAssessment(getDb(), auth, assessmentId),
  deleteClass: (auth, classId) => classroom.deleteClass(getDb(), auth, classId),
  deleteMembership: (auth, membershipId) => membership.deleteMembership(getDb(), auth, membershipId),
  getDb,
  getState,
  getSubmissionDetail: (auth, submissionId) => submission.getSubmissionDetail(getDb(), auth, submissionId),
  getSubmissionForUpdate: (auth, submissionId) => submission.getSubmissionForUpdate(getDb(), auth, submissionId),
  initDatabase,
  requestJoinClass: (tenantId, studentId, joinCode, membershipData) => classroom.requestJoinClass(getDb(), tenantId, studentId, joinCode, membershipData),
  assertTeacherOwnsClass: (tenantId, teacherId, classId) => classroom.assertTeacherOwnsClass(getDb(), tenantId, teacherId, classId),
  addApprovedStudent: (tenantId, classId, studentId, membershipId, now) => classroom.addApprovedStudent(getDb(), tenantId, classId, studentId, membershipId, now),
  saveAssessment: (auth, assessmentData) => assessment.saveAssessment(getDb(), auth, assessmentData),
  saveSubmission: (tenantId, userId, submissionData, bypassCheck) => submission.saveSubmission(getDb(), tenantId, userId, submissionData, bypassCheck),
  saveComplaint: (auth, submissionId, questionIndex, reason) => submission.saveComplaint(getDb(), auth, submissionId, questionIndex, reason),
  updateAssessment: (auth, assessmentId, patch) => assessment.updateAssessment(getDb(), auth, assessmentId, patch),
  updateClass: (auth, classId, patch) => classroom.updateClass(getDb(), auth, classId, patch),
  updateMembershipStatus: (auth, membershipId, status) => membership.updateMembershipStatus(getDb(), auth, membershipId, status),
  assertCanSubmitAssessment: (tenantId, userId, assessmentId) => submission.assertCanSubmitAssessment(getDb(), tenantId, userId, assessmentId),
  stripSubmissionAudio: submission.stripSubmissionAudio,
  saveQuestionToBank: (auth, question) => questionBank.saveQuestionToBank(getDb(), auth, question),
  listQuestionBank: (auth, filter) => questionBank.listQuestionBank(getDb(), auth, filter),
  deleteQuestionFromBank: (auth, questionId) => questionBank.deleteQuestionFromBank(getDb(), auth, questionId),
};
