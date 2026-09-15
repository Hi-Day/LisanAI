const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const API_DIR = path.join(ROOT, "api");
const APPLICATION_DIR = path.join(ROOT, "server", "application");
const FRONTEND_DIR = path.join(ROOT, "src", "js");
const MAX_VERCEL_FUNCTIONS = 12;

let failed = false;

const apiFunctions = fs.existsSync(API_DIR)
  ? fs.readdirSync(API_DIR).filter((name) => name.endsWith(".js"))
  : [];

if (apiFunctions.length > MAX_VERCEL_FUNCTIONS) {
  fail(`Vercel serverless function count is ${apiFunctions.length}; maximum is ${MAX_VERCEL_FUNCTIONS}.`);
} else {
  console.log(`Vercel function budget: ${apiFunctions.length}/${MAX_VERCEL_FUNCTIONS}`);
}

for (const file of collectJsFiles(APPLICATION_DIR)) {
  const source = fs.readFileSync(file, "utf8");
  const relative = path.relative(ROOT, file);

  if (/getDb\s*\(\)/.test(source)) {
    fail(`${relative}: application controllers must not access getDb() directly.`);
  }

  if (/\b(?:SELECT|INSERT|UPDATE|DELETE)\b/i.test(source) && /\bFROM\b|\bINTO\b|\bSET\b/i.test(source)) {
    fail(`${relative}: application controllers must not contain raw SQL.`);
  }

  if (/require\(["'](?:\.\.\/)+openrouter["']\)/.test(source) || /require\(["']\.\/openrouter["']\)/.test(source)) {
    fail(`${relative}: application layer must use server/ai/gateway, not legacy openrouter.`);
  }
}

checkFrontendRoleBoundaries();

if (failed) process.exit(1);
console.log("Architecture boundary checks passed.");

function checkFrontendRoleBoundaries() {
  const mainPath = path.join(FRONTEND_DIR, "main.js");
  if (!fs.existsSync(mainPath)) return;

  const source = fs.readFileSync(mainPath, "utf8");
  const roleBlocks = extractRoleBlocks(source);

  const requiredRoles = ["student", "teacher", "admin"];
  for (const role of requiredRoles) {
    if (!roleBlocks[role]) {
      fail(`src/js/main.js: missing explicit ROLE_FEATURES entry for ${role}.`);
    }
  }

  const forbiddenForStudent = [
    "./class-management.js",
    "./complaints.js",
    "./monitoring.js",
    "./question-bank.js",
    "./notifications.js",
    "./simulator.js",
    "./user-management.js",
    "./api-keys.js",
    "./research.js",
    "./observability.js",
  ];

  for (const modulePath of forbiddenForStudent) {
    if (roleBlocks.student.includes(modulePath)) {
      fail(`src/js/main.js: student role must not load teacher/admin module ${modulePath}.`);
    }
  }

  if (!roleBlocks.student.includes('./student-flow.js')) {
    fail("src/js/main.js: student role must explicitly load ./student-flow.js.");
  }
  if (!roleBlocks.student.includes('./student-class-management.js')) {
    fail("src/js/main.js: student role must explicitly load ./student-class-management.js.");
  }
  if (!roleBlocks.student.includes('./student-complaints.js')) {
    fail("src/js/main.js: student role must explicitly load ./student-complaints.js.");
  }

  const teacherOnlyModules = [
    "./class-management.js",
    "./complaints.js",
    "./assessment-wizard.js",
    "./assessment-ux.js",
  ];
  for (const modulePath of teacherOnlyModules) {
    if (!roleBlocks.teacher.includes(modulePath)) {
      fail(`src/js/main.js: teacher role must explicitly load ${modulePath}.`);
    }
    if (roleBlocks.student.includes(modulePath) || roleBlocks.admin.includes(modulePath)) {
      fail(`src/js/main.js: ${modulePath} is teacher-only but is exposed to another role.`);
    }
  }

  const adminOnlyModules = [
    "./user-management.js",
    "./api-keys.js",
    "./research.js",
    "./observability.js",
  ];
  for (const modulePath of adminOnlyModules) {
    if (!roleBlocks.admin.includes(modulePath)) {
      fail(`src/js/main.js: admin role must explicitly load ${modulePath}.`);
    }
    if (roleBlocks.student.includes(modulePath) || roleBlocks.teacher.includes(modulePath)) {
      fail(`src/js/main.js: ${modulePath} is admin-only but is exposed to another role.`);
    }
  }

  console.log("Frontend role-boundary checks passed.");
}

function extractRoleBlocks(source) {
  const roleBlocks = {};
  const rolePattern = /\b(student|teacher|admin):\s*\{/g;
  let match;

  while ((match = rolePattern.exec(source))) {
    const role = match[1];
    const start = match.index + match[0].length;
    let depth = 1;
    let index = start;

    while (index < source.length && depth > 0) {
      if (source[index] === "{") depth += 1;
      else if (source[index] === "}") depth -= 1;
      index += 1;
    }

    roleBlocks[role] = source.slice(start, index - 1);
  }

  return roleBlocks;
}

function fail(message) {
  failed = true;
  console.error(`Architecture violation: ${message}`);
}

function collectJsFiles(targetPath) {
  if (!fs.existsSync(targetPath)) return [];
  const stats = fs.statSync(targetPath);
  if (stats.isFile()) return targetPath.endsWith(".js") ? [targetPath] : [];
  return fs.readdirSync(targetPath, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules") return [];
    const fullPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) return collectJsFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".js") ? [fullPath] : [];
  });
}
