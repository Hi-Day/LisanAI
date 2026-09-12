const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const WIZARD = path.join(ROOT, "src", "js", "assessment-wizard.js");
const BUILD = path.join(ROOT, "scripts", "build.js");

let wizard = fs.readFileSync(WIZARD, "utf8");
let build = fs.readFileSync(BUILD, "utf8");

// Expose the active wizard context for the coverage action bridge.
const contextNeedle = /export function bindAssessmentWizardEvents\(ctx\)\s*\{\s*_wizardCtx = ctx;/;
if (!wizard.includes("window.__lisanAssessmentWizardCtx = ctx;")) {
  if (!contextNeedle.test(wizard)) throw new Error("Assessment wizard context marker not found.");
  wizard = wizard.replace(contextNeedle, (match) => `${match}\n  window.__lisanAssessmentWizardCtx = ctx;`);
}

// Replace the old rubric-criteria coverage renderer with CP coverage.
const rendererStart = wizard.indexOf("function renderAlignmentCoverage(ctx)");
if (rendererStart < 0) throw new Error("Assessment coverage renderer not found.");
const rendererEnd = wizard.indexOf("\nfunction ", rendererStart + 10);
if (rendererEnd < 0) throw new Error("Assessment coverage renderer boundary not found.");

const renderer = `function getUncoveredOutcomes(ctx) {
  const outcomes = Array.isArray(ctx.pendingAssessmentConfig?.outcomes)
    ? ctx.pendingAssessmentConfig.outcomes.map((value) => String(value || "").trim()).filter(Boolean)
    : String(ctx.pendingAssessmentConfig?.outcomes || "")
        .split(/\\n|[;|]/)
        .map((value) => value.trim())
        .filter(Boolean);
  const questions = Array.isArray(ctx.pendingQuestions) ? ctx.pendingQuestions : [];
  return outcomes.filter((outcome) => !questions.some((question) => String(question?.outcome || "").trim() === outcome));
}

function renderAlignmentCoverage(ctx) {
  const container = document.getElementById("alignmentCoverage");
  if (!container) return;

  const outcomes = Array.isArray(ctx.pendingAssessmentConfig?.outcomes)
    ? ctx.pendingAssessmentConfig.outcomes.map((value) => String(value || "").trim()).filter(Boolean)
    : String(ctx.pendingAssessmentConfig?.outcomes || "")
        .split(/\\n|[;|]/)
        .map((value) => value.trim())
        .filter(Boolean);
  const questions = Array.isArray(ctx.pendingQuestions) ? ctx.pendingQuestions : [];
  const uncovered = getUncoveredOutcomes(ctx);

  if (!outcomes.length) {
    container.innerHTML = "";
    return;
  }

  const covered = outcomes.length - uncovered.length;
  const items = outcomes.map((outcome) => {
    const questionCount = questions.filter((question) => String(question?.outcome || "").trim() === outcome).length;
    return `<div class="alignment-item ${questionCount ? "is-covered" : "is-uncovered"}">
      <span class="alignment-status">${questionCount ? "✓" : "!"}</span>
      <span><strong>${escapeHtml(outcome)}</strong><small>${questionCount ? `${questionCount} soal mengukur CP ini` : "Belum ada soal yang mengukur CP ini"}</small></span>
    </div>`;
  }).join("");

  container.innerHTML = `
    <div class="alignment-summary">
      <div><strong>Capaian Pembelajaran</strong><span>${covered}/${outcomes.length} terukur</span></div>
      <div class="alignment-items">${items}</div>
      ${uncovered.length ? `<div class="coverage-actions" data-coverage-actions="1">
        <p><strong>Masih ada CP yang belum terukur.</strong> Pilih tindakan berikut:</p>
        <div class="coverage-action-buttons">
          <button type="button" class="btn btn-primary" data-coverage-action="ai-align">✨ AI selaraskan soal</button>
          <button type="button" class="btn btn-secondary" data-coverage-action="ai-add">✨ Tambah soal dengan AI</button>
          <button type="button" class="btn btn-secondary" data-coverage-action="manual-add">＋ Tambah soal manual</button>
          <button type="button" class="btn btn-ghost" data-coverage-action="delete-outcomes">🗑 Hapus CP yang belum terukur</button>
        </div>
      </div>` : ""}
    </div>`;
}
`;

wizard = wizard.slice(0, rendererStart) + renderer + wizard.slice(rendererEnd + 1);

// Install the coverage action listener once. It delegates to the bridge exposed by the AI module.
const listenerMarker = "window.__lisanAssessmentCoverageActionsInstalled";
if (!wizard.includes(listenerMarker)) {
  const exportMarker = "export function bindAssessmentWizardEvents(ctx)";
  const pos = wizard.indexOf(exportMarker);
  if (pos < 0) throw new Error("Assessment wizard event binding marker not found.");
  const listener = `
  if (!window.__lisanAssessmentCoverageActionsInstalled) {
    window.__lisanAssessmentCoverageActionsInstalled = true;
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-coverage-action]");
      if (!button) return;
      const action = button.dataset.coverageAction;
      window.dispatchEvent(new CustomEvent("lisan:coverage-action", {
        detail: { action, ctx: window.__lisanAssessmentWizardCtx },
      }));
    });
  }
`;
  const brace = wizard.indexOf("{", pos);
  wizard = wizard.slice(0, brace + 1) + listener + wizard.slice(brace + 1);
}

fs.writeFileSync(WIZARD, wizard, "utf8");

// Add only the styles required by the coverage panel. Use a regex so formatting
// changes in build.js do not break the build-time patch.
const cssMarker = "#probingGatePanel";
const css = `
    .alignment-summary { margin-top: 14px; }
    .alignment-summary > div:first-child { display:flex; justify-content:space-between; gap:12px; margin-bottom:12px; }
    .alignment-items { display:grid; gap:8px; }
    .alignment-item { display:flex; gap:10px; align-items:flex-start; padding:10px 12px; border:1px solid var(--line); border-radius:12px; }
    .alignment-status { font-weight:700; }
    .alignment-item small { display:block; color:var(--muted); margin-top:3px; }
    .coverage-actions { margin-top:14px; padding:14px; border:1px dashed var(--line); border-radius:12px; }
    .coverage-actions p { margin:0 0 10px; }
    .coverage-action-buttons { display:flex; flex-wrap:wrap; gap:8px; }
`;

if (!build.includes(".alignment-summary")) {
  if (!build.includes(cssMarker)) throw new Error("Build CSS insertion marker not found.");
  const styleTextPattern = /style\.textContent\s*=\s*\$\{JSON\.stringify\(`([\s\S]*?)`\)\};/;
  const match = build.match(styleTextPattern);
  if (!match) throw new Error("Build UI polish style block not found.");
  const updated = match[1] + css;
  build = build.replace(styleTextPattern, `style.textContent = \${JSON.stringify(${JSON.stringify(updated)})};`);
}

fs.writeFileSync(BUILD, build, "utf8");
console.log("Applied assessment coverage actions and styles.");
