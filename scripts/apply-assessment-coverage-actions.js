const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const FILE = path.join(ROOT, "src", "js", "assessment-wizard.js");
let source = fs.readFileSync(FILE, "utf8");

if (!source.includes('window.__lisanAssessmentWizardCtx = ctx;')) {
  const marker = '  _wizardCtx = ctx;\n  const { els } = ctx;';
  if (!source.includes(marker)) throw new Error("Assessment wizard context marker not found.");
  source = source.replace(marker, '  _wizardCtx = ctx;\n  window.__lisanAssessmentWizardCtx = ctx;\n  const { els } = ctx;');
}

if (!source.includes('data-coverage-action')) {
  const marker = '  els.recommendOutcomes.addEventListener("click", () => fillRecommendedFields(ctx, "outcomes"));';
  if (!source.includes(marker)) throw new Error("Assessment wizard recommendation marker not found.");
  const replacement = `${marker}\n\n  if (els.reviewSummary) {\n    els.reviewSummary.addEventListener("click", async (event) => {\n      const button = event.target.closest("[data-coverage-action]");\n      if (!button) return;\n      const action = button.dataset.coverageAction;\n      const criterion = button.dataset.criterion || "";\n      await handleCoverageAction(ctx, action, criterion, button);\n    });\n  }`;
  source = source.replace(marker, replacement);
}

const coverageStart = source.indexOf('function renderAlignmentCoverage(ctx) {');
const coverageEnd = source.indexOf('\nexport function goToWizardStep', coverageStart);
if (coverageStart < 0 || coverageEnd < 0) throw new Error("Alignment coverage function boundary not found.");

const replacement = `function getUncoveredCriteria(ctx) {
  const { pendingQuestions } = ctx;
  const questionsWithCriteria = pendingQuestions.filter((q) => Array.isArray(q.criteria) && q.criteria.length > 0);
  const covered = new Set();
  questionsWithCriteria.forEach((q) => q.criteria.forEach((c) => covered.add(normalizeCoverageKey(typeof c === "string" ? c : c.name || c.id))));
  const rubricCriteria = [...new Set(pendingQuestions.flatMap((q) => parseRubricNames(q.rubric)))];
  return rubricCriteria.filter((name) => !covered.has(normalizeCoverageKey(name)));
}

function getUncoveredOutcomes(ctx) {
  const outcomes = String(ctx.pendingAssessmentConfig?.outcomes || "")
    .split(/\\r?\\n/)
    .map((item) => item.replace(/^\\s*[-*•]\\s*/, "").trim())
    .filter(Boolean);
  const used = ctx.pendingQuestions
    .map((q) => normalizeCoverageKey(q.outcome || ""))
    .filter(Boolean);
  return outcomes.filter((outcome) => {
    const key = normalizeCoverageKey(outcome);
    return !used.some((candidate) => candidate === key || candidate.includes(key) || key.includes(candidate));
  });
}

async function generateCoverageQuestionWithFallback(ctx, criterion) {
  let question = null;
  try {
    await streamAssessmentAction({
      action: "generate-question-for-uncovered-criterion",
      payload: {
        topic: ctx.pendingAssessmentConfig?.topic || "",
        outcomes: ctx.pendingAssessmentConfig?.outcomes || "",
        criterion,
        questions: ctx.pendingQuestions.map((q) => ({ prompt: q.prompt, outcome: q.outcome })),
      },
      onResult: (data) => { question = data?.question || null; },
    });
    return question;
  } catch (error) {
    showToast(`AI belum dapat membuat soal tambahan. Detail: ${error.message}`);
    return null;
  }
}

async function handleCoverageAction(ctx, action, criterion, button) {
  if (!ctx.pendingAssessmentConfig) return;
  syncQuestionsFromEditor(ctx);
  const original = button.textContent;
  button.disabled = true;
  try {
    if (action === "ai-align") {
      button.textContent = "AI sedang menyelaraskan...";
      ctx.pendingQuestions = await alignRubricWithFallback(ctx, ctx.pendingAssessmentConfig, ctx.pendingQuestions);
      renderQuestionEditor(ctx);
      goToWizardStep(ctx, 3);
      showToast("AI selesai menyelaraskan soal dengan rubrik.");
      return;
    }

    if (action === "add-ai-question") {
      button.textContent = "AI sedang membuat soal...";
      const target = criterion || getUncoveredCriteria(ctx)[0];
      if (!target) return;
      const question = await generateCoverageQuestionWithFallback(ctx, target);
      if (!question) return;
      ctx.pendingQuestions.push(question);
      ctx.pendingAssessmentConfig.count = ctx.pendingQuestions.length;
      renderQuestionEditor(ctx);
      goToWizardStep(ctx, 3);
      showToast(`Soal tambahan dibuat untuk kriteria: ${target}`);
      return;
    }

    if (action === "delete-uncovered-outcomes") {
      const uncovered = getUncoveredOutcomes(ctx);
      if (!uncovered.length) {
        showToast("Semua kompetensi sudah terhubung ke soal.");
        return;
      }
      const removed = new Set(uncovered.map(normalizeCoverageKey));
      const kept = String(ctx.pendingAssessmentConfig.outcomes || "")
        .split(/\\r?\\n/)
        .map((item) => item.trim())
        .filter((item) => item && !removed.has(normalizeCoverageKey(item)));
      ctx.pendingAssessmentConfig.outcomes = kept.join("\\n");
      if (ctx.els.outcomes) ctx.els.outcomes.value = ctx.pendingAssessmentConfig.outcomes;
      renderReviewSummary(ctx);
      showToast(`${uncovered.length} kompetensi yang belum terukur dihapus.`);
    }
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function renderAlignmentCoverage(ctx) {
  const uncoveredCriteria = getUncoveredCriteria(ctx);
  const uncoveredOutcomes = getUncoveredOutcomes(ctx);
  if (!uncoveredCriteria.length && !uncoveredOutcomes.length) return "";

  const criterionPreview = uncoveredCriteria.slice(0, 6);
  const criterionMore = uncoveredCriteria.length > criterionPreview.length ? ` dan ${uncoveredCriteria.length - criterionPreview.length} lainnya` : "";
  const outcomePreview = uncoveredOutcomes.slice(0, 4);
  const outcomeMore = uncoveredOutcomes.length > outcomePreview.length ? ` dan ${uncoveredOutcomes.length - outcomePreview.length} lainnya` : "";

  return `
    <div class="review-coverage-actions" role="alert">
      <div class="review-coverage-title">⚠ Cakupan penilaian belum lengkap</div>
      ${uncoveredOutcomes.length ? `
        <p><strong>${uncoveredOutcomes.length} kompetensi belum terukur:</strong> ${outcomePreview.map((n) => escapeHtml(n)).join("; ")}${escapeHtml(outcomeMore)}.</p>
      ` : ""}
      ${uncoveredCriteria.length ? `
        <p><strong>${uncoveredCriteria.length} kriteria rubrik belum diukur:</strong> ${criterionPreview.map((n) => escapeHtml(n)).join("; ")}${escapeHtml(criterionMore)}.</p>
      ` : ""}
      <div class="review-coverage-actions-row">
        ${uncoveredCriteria.length ? `<button type="button" class="secondary-button" data-coverage-action="ai-align">✨ AI selaraskan soal</button>` : ""}
        ${uncoveredCriteria.length ? `<button type="button" class="secondary-button" data-coverage-action="add-ai-question" data-criterion="${escapeHtml(uncoveredCriteria[0])}">✨ Tambah soal dengan AI</button>` : ""}
        ${uncoveredOutcomes.length ? `<button type="button" class="secondary-button danger-button" data-coverage-action="delete-uncovered-outcomes">Hapus kompetensi yang tidak terukur</button>` : ""}
      </div>
    </div>
  `;
}
`;

source = source.slice(0, coverageStart) + replacement + source.slice(coverageEnd);
fs.writeFileSync(FILE, source, "utf8");

const BUILD_FILE = path.join(ROOT, "scripts", "build.js");
let build = fs.readFileSync(BUILD_FILE, "utf8");
const cssMarker = '    /* Slower, eased motion: loading should feel continuous, not like a blink. */';
const css = `    .review-coverage-actions { margin: 12px 0 16px; padding: 14px; border: 1px solid rgba(180, 35, 24, .22); border-radius: 14px; background: rgba(180, 35, 24, .055); }\n    .review-coverage-title { font-weight: 800; margin-bottom: 7px; }\n    .review-coverage-actions p { margin: 6px 0; line-height: 1.5; }\n    .review-coverage-actions-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }\n    .review-coverage-actions-row .secondary-button { min-height: 38px; }\n`;
if (!build.includes(".review-coverage-actions {")) {
  if (!build.includes(cssMarker)) throw new Error("Build CSS marker not found.");
  build = build.replace(cssMarker, `${css}${cssMarker}`);
  fs.writeFileSync(BUILD_FILE, build, "utf8");
}

console.log("Applied assessment coverage actions and styles.");
