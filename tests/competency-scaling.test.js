const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

test("student competency reads are tenant/user scoped and bounded", () => {
  const source = fs.readFileSync(path.join(root, "server", "database", "competency-repository.js"), "utf8");
  assert.match(source, /tenant_id = \? AND user_id = \?/);
  assert.match(source, /ORDER BY submitted_at DESC LIMIT \?/);
  assert.match(source, /Math\.min\(1000/);
});

test("competency trajectory API requires an authenticated session", () => {
  const source = fs.readFileSync(path.join(root, "api", "competency-trajectory.js"), "utf8");
  assert.match(source, /getSessionUser/);
  assert.match(source, /if \(!auth\) return sendJson\(res, 401/);
});

test("teacher competency scope is tied to teacher-owned assessments", () => {
  const source = fs.readFileSync(path.join(root, "server", "database", "competency-repository.js"), "utf8");
  assert.match(source, /a\.tenant_id = \? AND a\.teacher_id = \?/);
});
