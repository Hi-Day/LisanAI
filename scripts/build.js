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
      js: `import("/js/learning-outcome-trend.js").catch(() => {});${assessmentUxEnhancement}`,
    },
  });

  fs.copyFileSync(
    path.join(ROOT, "src", "js", "learning-outcome-trend.js"),
    path.join(ROOT, "public", "js", "learning-outcome-trend.js")
  );

  console.log("Frontend bundle built successfully.");
  runProductionProvisioning();
  return result;
}

main().catch((error) => {
  console.error("Build failed:", error);
  process.exit(1);
});
