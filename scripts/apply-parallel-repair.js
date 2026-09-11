const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const FILE = path.join(ROOT, "src", "js", "pedagogical-gate.js");
let source = fs.readFileSync(FILE, "utf8");

const startMarker = "  let failed = false;\n  for (const index of affectedIndexes) {";
const endMarker = "\n\n  const applyButton = applyRow.querySelector(\".apply-repair\");";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start === -1 || end === -1) {
  throw new Error("Parallel repair loop target not found.");
}

const replacement = `  const results = await Promise.all(affectedIndexes.map(async (index) => {
    const nodes = afterNodes.get(index);
    if (nodes) nodes.meta.textContent = \`⏳ Memproses Soal \${index + 1}…\`;
    try {
      const response = await fetch("/api/assessment", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({
          action: "repair-pedagogical-grounding",
          stream: true,
          payload: {
            mode,
            topic,
            outcomes,
            issues: (result.issues || []).filter((issue) => Number(issue.index ?? issue.questionIndex) === index),
            questions: [questions[index]],
          },
        }),
      });
      await parseSse(response, index);
      return true;
    } catch (error) {
      const node = afterNodes.get(index);
      if (node) {
        node.output.innerHTML = \`<span class="repair-stream-error">⚠ \${escapeHtml(error.message)}</span>\`;
        node.meta.textContent = "Gagal diproses.";
      }
      return false;
    }
  }));

  const failed = results.some((ok) => !ok);`;

source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(FILE, source, "utf8");
console.log("Applied parallel pedagogical repair streaming.");
