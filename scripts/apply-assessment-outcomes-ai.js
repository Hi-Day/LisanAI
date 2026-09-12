const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const FILE = path.join(ROOT, "scripts", "build.js");
let source = fs.readFileSync(FILE, "utf8");

const importNeedle = 'import("/js/assessment-outcomes-ux.js").catch(()=>{});';
const importReplacement = `${importNeedle}import("/js/assessment-outcomes-ai.js").catch(()=>{});`;
if (!source.includes('import("/js/assessment-outcomes-ai.js")')) {
  if (!source.includes(importNeedle)) throw new Error("Assessment outcomes AI import target not found.");
  source = source.replace(importNeedle, importReplacement);
}

const copyNeedle = 'path.join(ROOT, "src", "js", "assessment-outcomes-ux.js")';
const copyReplacement = 'fs.copyFileSync(path.join(ROOT, "src", "js", "assessment-outcomes-ai.js"), path.join(ROOT, "public", "js", "assessment-outcomes-ai.js"));';
if (!source.includes('assessment-outcomes-ai.js"), path.join(ROOT, "public", "js", "assessment-outcomes-ai.js"')) {
  if (!source.includes(copyNeedle)) throw new Error("Assessment outcomes AI copy target not found.");
  const copyCallPattern = /fs\.copyFileSync\(\s*path\.join\(ROOT, "src", "js", "assessment-outcomes-ux\.js"\),\s*path\.join\(ROOT, "public", "js", "assessment-outcomes-ux\.js"\)\s*\);/;
  if (!copyCallPattern.test(source)) throw new Error("Assessment outcomes UX copy call not found.");
  source = source.replace(copyCallPattern, (match) => `${match}\n  ${copyReplacement}`);
}

fs.writeFileSync(FILE, source, "utf8");

console.log("Applied assessment outcomes AI integration.");
