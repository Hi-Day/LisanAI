const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const FILE = path.join(ROOT, "src", "js", "assessment-wizard.js");
let source = fs.readFileSync(FILE, "utf8");

source = source.replace(/Learning outcome \(kompetensi yang diukur\)/g, "Capaian Pembelajaran (kompetensi yang diukur)");
source = source.replace(/Rubrik yang diukur soal ini:/g, "Kriteria rubrik yang diukur soal ini:");
source = source.replace(/kompetensi yang belum terukur/g, "capaian pembelajaran yang belum terukur");
source = source.replace(/Semua kompetensi sudah terhubung ke soal\./g, "Semua capaian pembelajaran sudah terhubung ke soal.");

source = source.replace(
  'const criterion = button.dataset.criterion || "";\n      await handleCoverageAction(ctx, action, criterion, button);',
  'const target = button.dataset.target || "";\n      const targetType = button.dataset.targetType || "outcome";\n      await handleCoverageAction(ctx, action, target, targetType, button);'
);

source = source.replace(
  'async function handleCoverageAction(ctx, action, criterion, button) {',
  'async function handleCoverageAction(ctx, action, target, targetType, button) {'
);

source = source.replace(
  'const target = criterion || getUncoveredCriteria(ctx)[0];',
  'const target = target || getUncoveredOutcomes(ctx)[0] || getUncoveredCriteria(ctx)[0];'
);

source = source.replace(
  'criterion,\n        questions:',
  'criterion: targetType === "criterion" ? target : "",\n        coverageTarget: target,\n        coverageTargetType: targetType,\n        questions:'
);

if (!source.includes('action === "add-manual-question"')) {
  const marker = '    if (action === "delete-uncovered-outcomes") {';
  const handler = `    if (action === "add-manual-question") {\n      const outcome = targetType === "outcome" ? target : getAssessmentOutcomes(ctx)[0] || "";\n      ctx.pendingQuestions.push({\n        id: \`q-\${ctx.pendingQuestions.length}\`,\n        prompt: "",\n        focus: targetType === "outcome" ? \`Buktikan capaian pembelajaran: \${target}\` : \`Buktikan kriteria rubrik: \${target}\`,\n        outcome,\n        rubric: "",\n        ideal: "",\n        criteria: [],\n        probing: false,\n      });\n      ctx.pendingAssessmentConfig.count = ctx.pendingQuestions.length;\n      renderQuestionEditor(ctx);\n      goToWizardStep(ctx, 2);\n      showToast(\`Soal manual ditambahkan untuk \${targetType === "outcome" ? "capaian pembelajaran" : "kriteria rubrik"}.\`);\n      return;\n    }\n\n`;
  if (!source.includes(marker)) throw new Error("Coverage action handler marker not found.");
  source = source.replace(marker, handler + marker);
}

const start = source.indexOf('function renderAlignmentCoverage(ctx) {');
const end = source.indexOf('\nexport function goToWizardStep', start);
if (start < 0 || end < 0) throw new Error("Coverage renderer boundary not found.");

const renderer = `function renderAlignmentCoverage(ctx) {
  const uncoveredOutcomes = getUncoveredOutcomes(ctx);
  const uncoveredCriteria = getUncoveredCriteria(ctx);
  if (!uncoveredOutcomes.length && !uncoveredCriteria.length) return "";

  const primaryTarget = uncoveredOutcomes[0] || uncoveredCriteria[0] || "";
  const primaryType = uncoveredOutcomes.length ? "outcome" : "criterion";
  const outcomePreview = uncoveredOutcomes.slice(0, 4);
  const outcomeMore = uncoveredOutcomes.length > outcomePreview.length ? \` dan \${uncoveredOutcomes.length - outcomePreview.length} lainnya\` : "";
  const criterionPreview = uncoveredCriteria.slice(0, 6);
  const criterionMore = uncoveredCriteria.length > criterionPreview.length ? \` dan \${uncoveredCriteria.length - criterionPreview.length} lainnya\` : "";

  return \`
    <div class="review-coverage-actions" role="alert">
      <div class="review-coverage-title">⚠ Cakupan penilaian belum lengkap</div>
      \${uncoveredOutcomes.length ? \`<p><strong>\${uncoveredOutcomes.length} Capaian Pembelajaran belum terukur:</strong> \${outcomePreview.map((n) => escapeHtml(n)).join("; ")}\${escapeHtml(outcomeMore)}.</p>\` : ""}
      \${uncoveredCriteria.length ? \`<p><strong>\${uncoveredCriteria.length} kriteria rubrik belum diukur:</strong> \${criterionPreview.map((n) => escapeHtml(n)).join("; ")}\${escapeHtml(criterionMore)}.</p>\` : ""}
      <p class="review-coverage-help">Pilih cara menyelesaikan gap ini sebelum assessment dipublikasikan.</p>
      <div class="review-coverage-actions-row">
        <button type="button" class="secondary-button" data-coverage-action="ai-align">✨ AI selaraskan soal</button>
        <button type="button" class="secondary-button" data-coverage-action="add-ai-question" data-target="\${escapeHtml(primaryTarget)}" data-target-type="\${primaryType}">✨ Tambah soal dengan AI</button>
        <button type="button" class="secondary-button" data-coverage-action="add-manual-question" data-target="\${escapeHtml(primaryTarget)}" data-target-type="\${primaryType}">＋ Tambah soal manual</button>
        \${uncoveredOutcomes.length ? \`<button type="button" class="secondary-button danger-button" data-coverage-action="delete-uncovered-outcomes">Hapus Capaian Pembelajaran yang tidak terukur</button>\` : ""}
      </div>
    </div>
  \`;
}
`;
source = source.slice(0, start) + renderer + source.slice(end);

fs.writeFileSync(FILE, source, "utf8");
console.log("Finalized learning outcome coverage workflow.");
