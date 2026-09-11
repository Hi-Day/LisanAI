const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const FILE = path.join(ROOT, "src", "js", "pedagogical-gate.js");
let source = fs.readFileSync(FILE, "utf8");

const oldHandler = `const repair = await requestRepair(mode, result, gate);\n        renderRepairPreview(gate, repair);`;
const newHandler = `await requestRepair(mode, result, gate);`;
if (source.includes(oldHandler)) {
  source = source.replace(oldHandler, newHandler);
} else if (!source.includes(newHandler)) {
  throw new Error("Per-question repair handler target not found.");
}

const marker = `    .pedagogical-gate .repair-apply-row button { flex: 1 1 180px; }`;
const styles = `    .pedagogical-gate .repair-apply-row button { flex: 1 1 180px; }\n    .pedagogical-gate .repair-question-pair { display: grid; gap: 10px; }\n    .pedagogical-gate .repair-stream-output { min-height: 48px; line-height: 1.55; white-space: normal; }\n    .pedagogical-gate .repair-stream-placeholder { color: var(--muted); font-style: italic; }\n    .pedagogical-gate .repair-stream-meta { min-height: 18px; }\n    .pedagogical-gate .repair-stream-error { color: #b42318; }\n    @media (min-width: 640px) { .pedagogical-gate .repair-question-pair { grid-template-columns: 1fr 1fr; } }`;
if (source.includes(marker) && !source.includes(".repair-question-pair")) {
  source = source.replace(marker, styles);
}

fs.writeFileSync(FILE, source, "utf8");
console.log("Applied per-question repair handler and styles.");
