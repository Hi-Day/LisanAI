const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const FILE = path.join(ROOT, "src", "js", "assessment-wizard.js");
let source = fs.readFileSync(FILE, "utf8");

// Expose the active wizard context without depending on another patch's exact
// whitespace or context marker. This script runs more than once in the build.
if (!source.includes("window.__lisanAssessmentWizardCtx = ctx;")) {
  const contextAssignment = /(^|\n)([ \t]*)_wizardCtx\s*=\s*ctx;/.exec(source);
  if (!contextAssignment) throw new Error("Assessment wizard context assignment not found.");
  const indent = contextAssignment[2];
  const replacement = `${contextAssignment[0]}\n${indent}window.__lisanAssessmentWizardCtx = ctx;`;
  source = source.replace(contextAssignment[0], replacement);
}

// Delegate coverage actions from the wizard review container. Using a stable
// element id makes this independent of recommendation-button wording.
if (!source.includes("__lisanCoverageActionsBound")) {
  const marker = "  _wizardCtx = ctx;";
  const contextIndex = source.indexOf(marker);
  if (contextIndex < 0) throw new Error("Assessment wizard context marker not found.");
  const end = contextIndex + marker.length;
  const listener = `\n  if (!window.__lisanCoverageActionsBound && els.reviewSummary) {\n    window.__lisanCoverageActionsBound = true;\n    els.reviewSummary.addEventListener("click", async (event) => {\n      const button = event.target.closest("[data-coverage-action]");\n      if (!button) return;\n      const action = button.dataset.coverageAction;\n      const target = button.dataset.target || "";\n      const targetType = button.dataset.targetType || "outcome";\n      await handleCoverageAction(ctx, action, target, targetType, button);\n    });\n  }`;
  source = source.slice(0, end) + listener + source.slice(end);
}

const coverageStart = source.indexOf("function renderAlignmentCoverage(ctx) {");
const coverageEnd = source.indexOf("\nexport function goToWizardStep", coverageStart);
if (coverageStart < 0 || coverageEnd < 0) throw new Error("Alignment coverage function boundary not found.");

const replacement = [
  "function getUncoveredCriteria(ctx) {",
  "  const covered = new Set();",
  "  ctx.pendingQuestions.filter((q) => Array.isArray(q.criteria)).forEach((q) => q.criteria.forEach((c) => covered.add(normalizeCoverageKey(typeof c === \"string\" ? c : c.name || c.id))));",
  "  const rubricCriteria = [...new Set(ctx.pendingQuestions.flatMap((q) => parseRubricNames(q.rubric)))];",
  "  return rubricCriteria.filter((name) => !covered.has(normalizeCoverageKey(name)));",
  "}",
  "",
  "function getUncoveredOutcomes(ctx) {",
  "  const outcomes = String(ctx.pendingAssessmentConfig?.outcomes || \"\").split(/\\r?\\n/).map((item) => item.replace(/^\\s*[-*•]\\s*/, \"\").trim()).filter(Boolean);",
  "  const used = ctx.pendingQuestions.map((q) => normalizeCoverageKey(q.outcome || \"\")).filter(Boolean);",
  "  return outcomes.filter((outcome) => { const key = normalizeCoverageKey(outcome); return !used.some((candidate) => candidate === key || candidate.includes(key) || key.includes(candidate)); });",
  "}",
  "",
  "async function generateCoverageQuestionWithFallback(ctx, target, targetType) {",
  "  try {",
  "    let question = null;",
  "    await streamAssessmentAction({ action: \"generate-question-for-uncovered-criterion\", payload: { topic: ctx.pendingAssessmentConfig?.topic || \"\", outcomes: ctx.pendingAssessmentConfig?.outcomes || \"\", criterion: targetType === \"criterion\" ? target : \"\", coverageTarget: target, coverageTargetType: targetType, questions: ctx.pendingQuestions.map((q) => ({ prompt: q.prompt, outcome: q.outcome })) }, onResult: (data) => { question = data?.question || null; } });",
  "    return question;",
  "  } catch (error) { showToast(\"AI belum dapat membuat soal tambahan. Detail: \" + error.message); return null; }",
  "}",
  "",
  "async function handleCoverageAction(ctx, action, target, targetType, button) {",
  "  if (!ctx.pendingAssessmentConfig) return;",
  "  syncQuestionsFromEditor(ctx);",
  "  const original = button.textContent;",
  "  button.disabled = true;",
  "  try {",
  "    if (action === \"ai-align\") {",
  "      button.textContent = \"AI sedang menyelaraskan...\";",
  "      ctx.pendingQuestions = await alignRubricWithFallback(ctx, ctx.pendingAssessmentConfig, ctx.pendingQuestions);",
  "      renderQuestionEditor(ctx); goToWizardStep(ctx, 3); showToast(\"AI selesai menyelaraskan soal dengan rubrik.\"); return;",
  "    }",
  "    if (action === \"add-ai-question\") {",
  "      button.textContent = \"AI sedang membuat soal...\";",
  "      const question = await generateCoverageQuestionWithFallback(ctx, target, targetType);",
  "      if (!question) return;",
  "      ctx.pendingQuestions.push(question); ctx.pendingAssessmentConfig.count = ctx.pendingQuestions.length; renderQuestionEditor(ctx); goToWizardStep(ctx, 3);",
  "      showToast(\"Soal tambahan dibuat untuk \" + (targetType === \"outcome\" ? \"Capaian Pembelajaran\" : \"kriteria rubrik\") + \": \" + target); return;",
  "    }",
  "    if (action === \"add-manual-question\") {",
  "      const outcome = targetType === \"outcome\" ? target : getUncoveredOutcomes(ctx)[0] || \"\";",
  "      ctx.pendingQuestions.push({ id: \"q-\" + ctx.pendingQuestions.length, prompt: \"\", focus: targetType === \"outcome\" ? \"Buktikan capaian pembelajaran: \" + target : \"Buktikan kriteria rubrik: \" + target, outcome, rubric: \"\", ideal: \"\", criteria: [], probing: false });",
  "      ctx.pendingAssessmentConfig.count = ctx.pendingQuestions.length; renderQuestionEditor(ctx); goToWizardStep(ctx, 2);",
  "      showToast(\"Soal manual ditambahkan untuk \" + (targetType === \"outcome\" ? \"capaian pembelajaran\" : \"kriteria rubrik\") + \".\"); return;",
  "    }",
  "    if (action === \"delete-uncovered-outcomes\") {",
  "      const uncovered = getUncoveredOutcomes(ctx); if (!uncovered.length) { showToast(\"Semua capaian pembelajaran sudah terhubung ke soal.\"); return; }",
  "      const removed = new Set(uncovered.map(normalizeCoverageKey));",
  "      ctx.pendingAssessmentConfig.outcomes = String(ctx.pendingAssessmentConfig.outcomes || \"\").split(/\\r?\\n/).map((item) => item.trim()).filter((item) => item && !removed.has(normalizeCoverageKey(item))).join(\"\\n\");",
  "      if (ctx.els.outcomes) ctx.els.outcomes.value = ctx.pendingAssessmentConfig.outcomes; renderReviewSummary(ctx); showToast(uncovered.length + \" capaian pembelajaran yang belum terukur dihapus.\");",
  "    }",
  "  } finally { button.disabled = false; button.textContent = original; }",
  "}",
  "",
  "function renderAlignmentCoverage(ctx) {",
  "  const uncoveredOutcomes = getUncoveredOutcomes(ctx);",
  "  if (!uncoveredOutcomes.length) return \"\";",
  "  const preview = uncoveredOutcomes.slice(0, 4);",
  "  const more = uncoveredOutcomes.length > preview.length ? \" dan \" + (uncoveredOutcomes.length - preview.length) + \" lainnya\" : \"\";",
  "  const target = uncoveredOutcomes[0];",
  "  return '<div class=\"review-coverage-actions\" role=\"alert\">' +",
  "    '<div class=\"review-coverage-title\">⚠ Capaian Pembelajaran belum seluruhnya terukur</div>' +",
  "    '<p><strong>' + uncoveredOutcomes.length + ' Capaian Pembelajaran belum terukur:</strong> ' + preview.map((n) => escapeHtml(n)).join('; ') + escapeHtml(more) + '.</p>' +",
  "    '<p class=\"review-coverage-help\">Pilih cara menyelesaikan gap ini sebelum assessment dipublikasikan.</p>' +",
  "    '<div class=\"review-coverage-actions-row\">' +",
  "    '<button type=\"button\" class=\"secondary-button\" data-coverage-action=\"ai-align\" data-target=\"' + escapeHtml(target) + '\" data-target-type=\"outcome\">✨ AI selaraskan soal</button>' +",
  "    '<button type=\"button\" class=\"secondary-button\" data-coverage-action=\"add-ai-question\" data-target=\"' + escapeHtml(target) + '\" data-target-type=\"outcome\">✨ Tambah soal dengan AI</button>' +",
  "    '<button type=\"button\" class=\"secondary-button\" data-coverage-action=\"add-manual-question\" data-target=\"' + escapeHtml(target) + '\" data-target-type=\"outcome\">＋ Tambah soal manual</button>' +",
  "    '<button type=\"button\" class=\"secondary-button danger-button\" data-coverage-action=\"delete-uncovered-outcomes\">🗑 Hapus Capaian Pembelajaran</button>' +",
  "    '</div></div>';",
  "}",
].join("\n");

source = source.slice(0, coverageStart) + replacement + source.slice(coverageEnd);
fs.writeFileSync(FILE, source, "utf8");

const BUILD_FILE = path.join(ROOT, "scripts", "build.js");
let build = fs.readFileSync(BUILD_FILE, "utf8");
const cssMarker = '    /* Slower, eased motion: loading should feel continuous, not like a blink. */';
const css = '    .review-coverage-actions { margin: 12px 0 16px; padding: 14px; border: 1px solid rgba(180, 35, 24, .22); border-radius: 14px; background: rgba(180, 35, 24, .055); }\n    .review-coverage-title { font-weight: 800; margin-bottom: 7px; }\n    .review-coverage-actions p { margin: 6px 0; line-height: 1.5; }\n    .review-coverage-actions-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }\n    .review-coverage-actions-row .secondary-button { min-height: 38px; }\n';
if (!build.includes(".review-coverage-actions {")) {
  if (!build.includes(cssMarker)) throw new Error("Build CSS marker not found.");
  build = build.replace(cssMarker, css + cssMarker);
  fs.writeFileSync(BUILD_FILE, build, "utf8");
}

console.log("Applied assessment coverage actions and styles.");
