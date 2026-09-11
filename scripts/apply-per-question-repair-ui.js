const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const file = path.join(ROOT, "src", "js", "pedagogical-gate.js");
const functionSource = fs.readFileSync(path.join(__dirname, "per-question-repair-function.txt"), "utf8").trim();
let source = fs.readFileSync(file, "utf8");

const start = source.indexOf("async function requestRepair(mode, result, gate) {");
const end = source.indexOf("\n\nfunction renderRepairPreview", start);
if (start === -1 || end === -1) throw new Error("Streaming pedagogical repair function target not found.");

source = source.slice(0, start) + functionSource + source.slice(end);
fs.writeFileSync(file, source, "utf8");
console.log("Applied per-question pedagogical repair streaming UI.");
