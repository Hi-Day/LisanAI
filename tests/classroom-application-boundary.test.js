const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const servicePath = path.join(root, "server", "application", "classroom-service.js");
const controllerPath = path.join(root, "server", "application", "data-controller.js");
const gatewayPath = path.join(root, "server", "database", "classroom-gateway.js");
const classroomRepositoryPath = path.join(root, "server", "database", "classroom-repository.js");
const membershipRepositoryPath = path.join(root, "server", "database", "membership-repository.js");

function read(file) { return fs.readFileSync(file, "utf8"); }

test("classroom application service owns classroom orchestration", () => {
  const source = read(servicePath);
  for (const method of ["createClass", "updateClass", "deleteClass", "joinClass", "approveMembership", "updateMembership", "deleteMembership", "assertTeacherOwnsClass", "addApprovedStudent"]) {
    assert.ok(source.includes(method), `classroom service should expose ${method}`);
  }
  assert.doesNotMatch(source, /\b(?:SELECT|INSERT|UPDATE|DELETE)\b/i);
  assert.doesNotMatch(source, /require\(["']\.\.\/database\/client["']\)/);
  assert.doesNotMatch(source, /getDb\s*\(/);
  assert.match(source, /classroomGateway/);
});

test("data controller delegates classroom actions", () => {
  const source = read(controllerPath);
  assert.match(source, /require\(["']\.\/classroom-service["']\)/);
  for (const method of ["createClass", "updateClass", "deleteClass", "joinClass", "approveMembership", "updateMembership", "deleteMembership", "assertTeacherOwnsClass", "addApprovedStudent"]) {
    assert.ok(source.includes(`classroomService.${method}`), `data controller should delegate ${method}`);
  }
  const databaseImport = source.match(/const \{([\s\S]*?)\} = require\(["']\.\.\/database["']\);/);
  assert.ok(databaseImport, "data controller should retain its database facade for non-classroom concerns");
  for (const method of ["approveMembership", "createClass", "deleteClass", "deleteMembership", "requestJoinClass", "updateClass", "updateMembershipStatus", "assertTeacherOwnsClass", "addApprovedStudent"]) {
    assert.ok(!new RegExp(`\\b${method}\\b`).test(databaseImport[1]), `database facade import should not contain ${method}`);
  }
});

test("classroom gateway owns database client access", () => {
  const source = read(gatewayPath);
  assert.match(source, /require\(["']\.\/client["']\)/);
  assert.match(source, /getDb\s*\(/);
  assert.match(source, /classroom-repository/);
  assert.match(source, /membership-repository/);
});

test("classroom repositories remain persistence boundaries", () => {
  assert.match(read(classroomRepositoryPath), /db\.(?:get|run|all)/);
  assert.match(read(classroomRepositoryPath), /classes/);
  assert.match(read(membershipRepositoryPath), /db\.(?:get|run|all)/);
  assert.match(read(membershipRepositoryPath), /class_memberships/);
});
