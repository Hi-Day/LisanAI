const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { build } = require("esbuild");

const ROOT = path.join(__dirname, "..");

function runProductionProvisioning() {
  if (process.env.VERCEL_ENV !== "production") return;

  const scripts = [
    "scripts/provision-pendopo-demo.js",
    "scripts/verify-pendopo-demo.js",
  ];

  for (const script of scripts) {
    console.log(`Running production database step: ${script}`);
    execFileSync(process.execPath, [path.join(ROOT, script)], {
      cwd: ROOT,
      env: process.env,
      stdio: "inherit",
    });
  }
}

const assessmentUxEnhancement = `
(function enhanceAssessmentWizardUX() {
  function apply() {
    const form = document.getElementById("assessmentForm");
    const panel = form?.querySelector('[data-wizard-panel="1"]');
    if (!form || !panel || panel.dataset.uxEnhanced === "1") return;

    const classLabel = document.getElementById("classSelect")?.closest("label");
    const countLabel = document.getElementById("questionCount")?.closest("label");
    const difficultyLabel = document.getElementById("difficulty")?.closest("label");
    const timeLimitLabel = document.getElementById("timeLimit")?.closest("label");
    const attemptsLabel = document.getElementById("maxAttempts")?.closest("label");
    const examplesLabel = document.getElementById("examples")?.closest("label");
    const checks = panel.querySelector(":scope > .wizard-checks");
    const classRow = classLabel?.parentElement?.classList.contains("form-row-2") ? classLabel.parentElement : null;
    const countRow = countLabel?.parentElement?.classList.contains("form-row-2") ? countLabel.parentElement : null;

    if (!classLabel || !countLabel || !difficultyLabel || !timeLimitLabel || !attemptsLabel) return;

    const coreGrid = document.createElement("div");
    coreGrid.className = "assessment-core-grid";
    coreGrid.setAttribute("aria-label", "Pengaturan utama penilaian");
    classLabel.remove();
    countLabel.remove();
    coreGrid.append(classLabel, countLabel);

    const outcomesLabel = document.getElementById("outcomes")?.closest("label");
    outcomesLabel?.after(coreGrid);

    if (classRow) classRow.remove();
    if (countRow && countRow !== classRow) countRow.remove();

    const advanced = document.createElement("details");
    advanced.className = "assessment-advanced-settings";
    const summary = document.createElement("summary");
    summary.textContent = "⚙ Pengaturan lanjutan";
    const hint = document.createElement("p");
    hint.className = "assessment-advanced-hint";
    hint.textContent = "Gunakan bila perlu. Pengaturan utama di atas sudah cukup untuk membuat penilaian.";
    const body = document.createElement("div");
    body.className = "assessment-advanced-body";
    advanced.append(summary, hint, body);

    [difficultyLabel, timeLimitLabel, attemptsLabel, checks, examplesLabel].forEach((node) => {
      if (node) body.appendChild(node);
    });
    panel.appendChild(advanced);
    panel.dataset.uxEnhanced = "1";
  }

  function start() {
    apply();
    if (!document.getElementById("assessmentForm")?.querySelector('[data-wizard-panel="1"]')) {
      requestAnimationFrame(start);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
`;

const uiPolishEnhancement = `
(function installLisanUIPolish() {
  const style = document.createElement("style");
  style.id = "lisan-ui-polish";
  style.textContent = ${JSON.stringify(`
    /* Adaptive probing belongs to the teacher's monitoring workflow, not assessment creation. */
    #probingGatePanel {
      margin: 0 0 20px;
    }
    #probingGatePanel.is-empty {
      display: none;
    }
    .probing-gate-panel {
      border: 1px solid var(--line);
      border-radius: 16px;
      background: var(--panel);
      box-shadow: var(--shadow-subtle);
      overflow: hidden;
    }
    .probing-gate-heading {
      padding: 18px 20px;
    }
    .probing-gate-heading h3 {
      margin: 0 0 5px;
    }
    .probing-gate-heading p {
      margin: 0;
      color: var(--muted);
      line-height: 1.5;
    }
    .probing-gate-list-wrap {
      padding: 0 20px 20px;
    }

    /* Slower, eased motion: loading should feel continuous, not like a blink. */
    @keyframes lisanSmoothCaret {
      0%, 42% { opacity: 1; }
      50%, 92% { opacity: 0.2; }
      100% { opacity: 1; }
    }
    @keyframes lisanSmoothShimmer {
      0% { background-position: 180% 0; }
      100% { background-position: -80% 0; }
    }
    @keyframes lisanSmoothSpin {
      to { transform: rotate(360deg); }
    }
    .probing-caret,
    .probing-stream-caret {
      animation: lisanSmoothCaret 1.8s ease-in-out infinite !important;
    }
    .skeleton,
    .ai-skeleton-card {
      animation: lisanSmoothShimmer 2.8s ease-in-out infinite !important;
    }
    .ai-stream-spinner,
    .loading-spinner,
    .spinner,
    .button-spinner,
    .evaluation-spinner {
      animation: lisanSmoothSpin 1.8s linear infinite !important;
    }
    .recording-indicator,
    .record-button.recording::before,
    .record-button.recording::after {
      animation-duration: 1.8s !important;
      animation-timing-function: ease-in-out !important;
    }
    .fade-in,
    .fadeIn {
      animation-duration: 0.45s !important;
      animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1) !important;
    }
    @media (prefers-reduced-motion: reduce) {
      #probingGatePanel *, .skeleton, .ai-skeleton-card {
        animation: none !important;
      }
    }
  `)};
  document.head.appendChild(style);
})();
`;

async function main() {
  const result = await build({
    entryPoints: [path.join(ROOT, "src", "js", "app.js")],
    outfile: path.join(ROOT, "public", "js", "app.bundle.js"),
    bundle: true,
    minify: true,
    sourcemap: false,
    format: "esm",
    target: ["es2020"],
    logLevel: "info",
    banner: {
      js: `import("/js/learning-outcome-trend.js").catch(() => {});import("/js/probing-gate.js").then(m=>m.installProbingGate()).catch(()=>{});import("/js/pedagogical-gate.js").catch(()=>{});${assessmentUxEnhancement}${uiPolishEnhancement}`,
    },
  });

  fs.copyFileSync(
    path.join(ROOT, "src", "js", "learning-outcome-trend.js"),
    path.join(ROOT, "public", "js", "learning-outcome-trend.js")
  );
  fs.copyFileSync(
    path.join(ROOT, "src", "js", "probing-gate.js"),
    path.join(ROOT, "public", "js", "probing-gate.js")
  );
  fs.copyFileSync(
    path.join(ROOT, "src", "js", "pedagogical-gate.js"),
    path.join(ROOT, "public", "js", "pedagogical-gate.js")
  );

  console.log("Frontend bundle built successfully.");
  runProductionProvisioning();
  return result;
}

main().catch((error) => {
  console.error("Build failed:", error);
  process.exit(1);
});