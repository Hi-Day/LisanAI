const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const FILE = path.join(ROOT, "src", "js", "assessment-wizard.js");
let source = fs.readFileSync(FILE, "utf8");

// Canonical terminology: Capaian Pembelajaran is the competency target;
// rubric criteria remain the evidence/scoring dimensions.
source = source.replace(/Learning outcome \(kompetensi yang diukur\)/g, "Capaian Pembelajaran (kompetensi yang diukur)");
source = source.replace(/Rubrik yang diukur soal ini:/g, "Kriteria rubrik yang diukur soal ini:");
source = source.replace(/kompetensi yang belum terukur/g, "capaian pembelajaran yang belum terukur");
source = source.replace(/Semua kompetensi sudah terhubung ke soal\./g, "Semua capaian pembelajaran sudah terhubung ke soal.");

// The purple chip beside each question is the CP mapping. Rubric criteria are
// rendered in the rubric section below it and are not used as the CP label.
const oldCriteriaChip = `      \${
        Array.isArray(question.criteria) && question.criteria.length
          ? \`<div class="q-criteria-chip">Rubrik yang diukur soal ini: \${question.criteria
              .map((c) => (typeof c === "string" ? c : c.name || prettifyId(c.id)))
              .map(escapeHtml)
              .join(" · ")}</div>\`
          : ""
      }`;
const newOutcomeChip = `      \${
        question.outcome
          ? \`<div class="q-criteria-chip">Capaian Pembelajaran yang diukur: \${escapeHtml(question.outcome)}</div>\`
          : ""
      }`;
if (source.includes(oldCriteriaChip)) {
  source = source.replace(oldCriteriaChip, newOutcomeChip);
}

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
  const handler = `    if (action === "add-manual-question") {
      const outcome = targetType === "outcome" ? target : getAssessmentOutcomes(ctx)[0] || "";
      ctx.pendingQuestions.push({
        id: \`q-\${ctx.pendingQuestions.length}\`,
        prompt: "",
        focus: targetType === "outcome" ? \`Buktikan capaian pembelajaran: \${target}\` : \`Buktikan kriteria rubrik: \${target}\`,
        outcome,
        rubric: "",
        ideal: "",
        criteria: [],
        probing: false,
      });
      ctx.pendingAssessmentConfig.count = ctx.pendingQuestions.length;
      renderQuestionEditor(ctx);
      goToWizardStep(ctx, 2);
      showToast(\`Soal manual ditambahkan untuk \${targetType === "outcome" ? "capaian pembelajaran" : "kriteria rubrik"}.\`);
      return;
    }

`;
  if (!source.includes(marker)) throw new Error("Coverage action handler marker not found.");
  source = source.replace(marker, handler + marker);
}

const start = source.indexOf('function renderAlignmentCoverage(ctx) {');
const end = source.indexOf('\nexport function goToWizardStep', start);
if (start < 0 || end < 0) throw new Error("Coverage renderer boundary not found.");

// Review coverage is about Capaian Pembelajaran only. Rubric criteria are
// question-level evidence dimensions and are intentionally excluded from the
// CP coverage warning.
const renderer = `function renderAlignmentCoverage(ctx) {
  const uncoveredOutcomes = getUncoveredOutcomes(ctx);
  if (!uncoveredOutcomes.length) return "";

  const outcomePreview = uncoveredOutcomes.slice(0, 4);
  const outcomeMore = uncoveredOutcomes.length > outcomePreview.length ? \` dan \${uncoveredOutcomes.length - outcomePreview.length} lainnya\` : "";
  const primaryTarget = uncoveredOutcomes[0] || "";

  return \`
    <div class="review-coverage-actions" role="alert">
      <div class="review-coverage-title">⚠ Capaian Pembelajaran belum seluruhnya terukur</div>
      <p><strong>\${uncoveredOutcomes.length} Capaian Pembelajaran belum terukur:</strong> \${outcomePreview.map((n) => escapeHtml(n)).join("; ")}\${escapeHtml(outcomeMore)}.</p>
      <p class="review-coverage-help">Pilih cara menyelesaikan gap ini sebelum assessment dipublikasikan.</p>
      <div class="review-coverage-actions-row">
        <button type="button" class="secondary-button" data-coverage-action="ai-align" data-target="\${escapeHtml(primaryTarget)}" data-target-type="outcome">✨ AI selaraskan soal</button>
        <button type="button" class="secondary-button" data-coverage-action="add-ai-question" data-target="\${escapeHtml(primaryTarget)}" data-target-type="outcome">✨ Tambah soal dengan AI</button>
        <button type="button" class="secondary-button" data-coverage-action="add-manual-question" data-target="\${escapeHtml(primaryTarget)}" data-target-type="outcome">＋ Tambah soal manual</button>
        <button type="button" class="secondary-button danger-button" data-coverage-action="delete-uncovered-outcomes">🗑 Hapus Capaian Pembelajaran</button>
      </div>
    </div>
  \`;
}
`;
source = source.slice(0, start) + renderer + source.slice(end);

fs.writeFileSync(FILE, source, "utf8");
console.log("Finalized Capaian Pembelajaran coverage workflow.");
