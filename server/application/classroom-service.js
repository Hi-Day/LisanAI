const classroomGateway = require("../database/classroom-gateway");

async function createClass(auth, classroom) {
  return classroomGateway.createClass(auth.tenant.id, auth.user.id, classroom);
}

async function updateClass(auth, classId, patch) {
  return classroomGateway.updateClass(auth, classId, patch);
}

async function deleteClass(auth, classId) {
  return classroomGateway.deleteClass(auth, classId);
}

async function joinClass(auth, joinCode, membership) {
  return classroomGateway.requestJoinClass(auth.tenant.id, auth.user.id, joinCode, membership);
}

async function approveMembership(auth, membershipId) {
  return classroomGateway.approveMembership(auth.tenant.id, auth.user.id, membershipId);
}

async function updateMembership(auth, membershipId, status) {
  return classroomGateway.updateMembershipStatus(auth, membershipId, status);
}

async function deleteMembership(auth, membershipId) {
  return classroomGateway.deleteMembership(auth, membershipId);
}

async function assertTeacherOwnsClass(auth, classId) {
  return classroomGateway.assertTeacherOwnsClass(auth.tenant.id, auth.user.id, classId);
}

async function addApprovedStudent(auth, classId, studentId, membershipId, now) {
  return classroomGateway.addApprovedStudent(auth.tenant.id, classId, studentId, membershipId, now);
}

module.exports = {
  createClass,
  updateClass,
  deleteClass,
  joinClass,
  approveMembership,
  updateMembership,
  deleteMembership,
  assertTeacherOwnsClass,
  addApprovedStudent,
};
