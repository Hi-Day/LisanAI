const { getDb } = require("./client");
const classroomRepository = require("./classroom-repository");
const membershipRepository = require("./membership-repository");

module.exports = {
  createClass: (tenantId, teacherId, classroom) =>
    classroomRepository.createClass(getDb(), tenantId, teacherId, classroom),
  updateClass: (auth, classId, patch) =>
    classroomRepository.updateClass(getDb(), auth, classId, patch),
  deleteClass: (auth, classId) =>
    classroomRepository.deleteClass(getDb(), auth, classId),
  requestJoinClass: (tenantId, studentId, joinCode, membership) =>
    classroomRepository.requestJoinClass(getDb(), tenantId, studentId, joinCode, membership),
  assertTeacherOwnsClass: (tenantId, teacherId, classId) =>
    classroomRepository.assertTeacherOwnsClass(getDb(), tenantId, teacherId, classId),
  addApprovedStudent: (tenantId, classId, studentId, membershipId, now) =>
    classroomRepository.addApprovedStudent(getDb(), tenantId, classId, studentId, membershipId, now),
  approveMembership: (tenantId, teacherId, membershipId) =>
    membershipRepository.approveMembership(getDb(), tenantId, teacherId, membershipId),
  updateMembershipStatus: (auth, membershipId, status) =>
    membershipRepository.updateMembershipStatus(getDb(), auth, membershipId, status),
  deleteMembership: (auth, membershipId) =>
    membershipRepository.deleteMembership(getDb(), auth, membershipId),
};
