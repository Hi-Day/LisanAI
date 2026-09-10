/**
 * Progressive disclosure for assessment creation settings.
 * Keeps all existing controls and IDs intact while reducing the initial
 * cognitive load of the assessment wizard.
 */
export function enhanceAssessmentWizardUX(ctx) {
  const form = ctx?.els?.form;
  if (!form || form.dataset.advancedSettingsEnhanced === "true") return;

  const advancedIds = [
    "difficulty",
    "timeLimit",
    "maxAttempts",
    "oralExamEnabled",
    "disableManualTyping",
    "allowRetakes",
    "isTryout",
    "examples",
  ];

  const controls = advancedIds
    .map((id) => document.getElementById(id))
    .filter((element) => element && form.contains(element));
  if (!controls.length) return;

  const details = document.createElement("details");
  details.className = "advanced-settings";
  details.style.margin = "12px 0 16px";
  details.style.padding = "0";

  const summary = document.createElement("summary");
  summary.textContent = "⚙️ Pengaturan lanjutan";
  summary.style.cursor = "pointer";
  summary.style.fontWeight = "600";
  summary.style.padding = "10px 0";
  details.appendChild(summary);

  const hint = document.createElement("p");
  hint.textContent = "Opsional. Pengaturan ini dapat dibiarkan pada nilai default untuk mulai dengan cepat.";
  hint.style.margin = "0 0 12px";
  hint.style.fontSize = "0.88rem";
  hint.style.opacity = "0.72";
  details.appendChild(hint);

  const panel = document.createElement("div");
  panel.className = "advanced-settings-panel";
  panel.style.display = "grid";
  panel.style.gap = "12px";
  details.appendChild(panel);

  // Insert before the first advanced control's containing form row/label.
  const firstControl = controls[0];
  const insertionPoint = firstControl.closest(".form-row-2") || firstControl.closest("label") || firstControl;
  insertionPoint.parentNode.insertBefore(details, insertionPoint);

  controls.forEach((control) => {
    const label = control.closest("label");
    if (label && form.contains(label)) {
      panel.appendChild(label);
    }
  });

  // Move the checkbox group as a unit when it still contains the advanced flags.
  const checks = form.querySelector(".wizard-checks");
  if (checks && !checks.closest(".advanced-settings") && controls.some((control) => checks.contains(control))) {
    panel.appendChild(checks);
  }

  // Remove form rows that became empty after extracting advanced fields.
  form.querySelectorAll(".form-row-2").forEach((row) => {
    const hasControl = row.querySelector("input, select, textarea, button");
    const hasText = [...row.childNodes].some((node) =>
      node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
    );
    if (!hasControl && !hasText) row.remove();
  });

  // Make the primary path explicit without changing the existing controls.
  const primaryButton = form.querySelector("#wizardToQuestions") || form.querySelector("button[type='submit']");
  if (primaryButton) {
    primaryButton.setAttribute("data-primary-action", "true");
  }

  form.dataset.advancedSettingsEnhanced = "true";
}
