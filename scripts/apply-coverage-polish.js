const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const FILE = path.join(ROOT, "src", "js", "assessment-wizard.js");
let source = fs.readFileSync(FILE, "utf8");

source = source.replace(/Learning outcome \(kompetensi yang diukur\)/g, "Capaian Pembelajaran (kompetensi yang diukur)");
source = source.replace(/Rubrik yang diukur soal ini:/g, "Kriteria rubrik yang diukur soal ini:");
source = source.replace(/kompetensi yang belum terukur/g, "capaian pembelajaran yang belum terukur");
source = source.replace(/Semua kompetensi sudah terhubung ke soal\./g, "Semua capaian pembelajaran sudah terhubung ke soal.");

if (!source.includes('data-coverage-action="add-manual-question"')) {
  const marker = '${uncoveredOutcomes.length ? `<button type="button" class="secondary-button danger-button" data-coverage-action="delete-uncovered-outcomes">Hapus capaian pembelajaran yang tidak terukur</button>` : ""}';
  const replacement = '${uncoveredOutcomes.length ? `<button type="button" class="secondary-button danger-button" data-coverage-action="delete-uncovered-outcomes">Hapus capaian pembelajaran yang tidak terukur</button>` : ""}\n        <button type="button" class="secondary-button" data-coverage-action="add-manual-question" data-target="${escapeHtml(primaryTarget)}" data-target-type="${primaryType}">＋ Tambah soal manual</button>';
  if (source.includes(marker)) {
    source = source.replace(marker, replacement);
  }

  const oldHandler = '    if (action === "delete-uncovered-outcomes") {';
  const manualHandler = '    if (action === "add-manual-question") {\n      const outcome = targetType === "outcome" ? target : getAssessmentOutcomes(ctx)[0] || "";\n      ctx.pendingQuestions.push({\n        id: `q-${ctx.pendingQuestions.length}`,\n        prompt: "",\n        focus: targetType === "outcome" ? `Buktikan capaian pembelajaran: ${target}` : `Buktikan kriteria rubrik: ${target}`,\n        outcome,\n        rubric: "",\n        ideal: "",\n        criteria: [],\n        probing: false,\n      });\n      ctx.pendingAssessmentConfig.count = ctx.pendingQuestions.length;\n      renderQuestionEditor(ctx);\n      goToWizardStep(ctx, 2);\n      showToast(`Soal manual ditambahkan untuk ${targetType === "outcome" ? "capaian pembelajaran" : "kriteria rubrik"}.`);\n      return;\n    }\n\n';
  if (source.includes(oldHandler) && !source.includes('action === "add-manual-question"')) {
    source = source.replace(oldHandler, manualHandler + oldHandler);
  }
}

fs.writeFileSync(FILE, source, "utf8");
console.log("Applied canonical competency terminology and manual coverage action.");
