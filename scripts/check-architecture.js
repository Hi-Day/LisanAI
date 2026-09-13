const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const API_DIR = path.join(ROOT, "api");
const APPLICATION_DIR = path.join(ROOT, "server", "application");
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

if (failed) process.exit(1);
console.log("Architecture boundary checks passed.");

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
