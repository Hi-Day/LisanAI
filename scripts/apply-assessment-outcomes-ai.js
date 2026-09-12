const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const FILE = path.join(ROOT, "scripts", "build.js");
let source = fs.readFileSync(FILE, "utf8");

const importMarker = 'import("/js/assessment-outcomes-ux.js").catch(()=>{});';
const importReplacement = `${importMarker}import("/js/assessment-outcomes-ai.js").catch(()=>{});`;
if (!source.includes(importReplacement)) {
  if (!source.includes(importMarker)) throw new Error("Assessment outcomes AI import target not found.");
  source = source.replace(importMarker, importReplacement);
}

const copyMarker = `  fs.copyFileSync(\n    path.join(ROOT, "src", "js", "assessment-outcomes-ux.js"),\n    path.join(ROOT, "public", "js", "assessment-outcomes-ux.js")\n  );`;
const copyReplacement = `${copyMarker}\n  fs.copyFileSync(\n    path.join(ROOT, "src", "js", "assessment-outcomes-ai.js"),\n    path.join(ROOT, "public", "js", "assessment-outcomes-ai.js")\n  );`;
if (!source.includes(copyReplacement)) {
  if (!source.includes(copyMarker)) throw new Error("Assessment outcomes AI copy target not found.");
  source = source.replace(copyMarker, copyReplacement);
}

fs.writeFileSync(FILE, source, "utf8");

// Coverage actions is the canonical wizard-side coverage patch. The old
// apply-coverage-final.js duplicated this work and contained nested template
// literals that could break the Vercel build, so it is intentionally not run.
for (const script of [
  "apply-assessment-coverage-actions.js",
  "apply-coverage-backend.js",
]) {
  execFileSync(process.execPath, [path.join(__dirname, script)], {
    cwd: ROOT,
    env: process.env,
    stdio: "inherit",
  });
}

console.log("Applied assessment outcomes AI and coverage workflow integration.");
