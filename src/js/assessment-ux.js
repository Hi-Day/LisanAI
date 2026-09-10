/**
 * Progressive disclosure for assessment creation settings.
 * Keeps all existing controls and IDs intact while reducing the initial
 * cognitive load of the assessment wizard.
 */
export function enhanceAssessmentWizardUX(ctx) {
  const form = ctx?.els?.form;
  if (!form || form.dataset.advancedSettingsEnhanced === "true") return;

  const fieldIds = ["difficulty", "timeLimit", "maxAttempts", "examples"];
  const controls = fieldIds
    .map((id) => document.getElementById(id))
    .filter((element) => element && form.contains(element));
  const checks = form.querySelector(".wizard-checks");
  const hasAdvancedContent = controls.length > 0 || !!checks;
  if (!hasAdvancedContent) return;

  const details = document.createElement("details");
  details.className = "advanced-settings";
  details.style.margin = "12px 0 16px";

  const summary = document.createElement("summary");
  summary.textContent = "⚙️ Pengaturan lanjutan";
  summary.style.cursor = "pointer";
  summary.style.fontWeight = "600";
  summary.style.padding = "10px 0";
  details.appendChild(summary);

  const hint = document.createElement("p");
  hint.textContent = "Opsional. Nilai default sudah cukup untuk mulai membuat penilaian.";
  hint.style.margin = "0 0 12px";
  hint.style.fontSize = "0.88rem";
  hint.style.opacity = "0.72";
  details.appendChild(hint);

  const panel = document.createElement("div");
  panel.className = "advanced-settings-panel";
  panel.style.display = "grid";
  panel.style.gap = "12px";
  details.appendChild(panel);

  // Put the disclosure control before the first advanced field, while leaving
  // the primary context fields (topic, outcomes, class, question count) open.
  const firstControl = controls[0] || checks.querySelector("input, select, textarea");
  const insertionPoint = firstControl?.closest(".form-row-2") || firstControl?.closest("label") || checks || firstControl;
  if (!insertionPoint?.parentNode) return;
  insertionPoint.parentNode.insertBefore(details, insertionPoint);

  // Move individual advanced field labels out of their original two-column rows.
  controls.forEach((control) => {
    const label = control.closest("label");
    if (label) panel.appendChild(label);
  });

  // Keep the checkbox group intact so all existing checkbox IDs and styling
  // continue to work together.
  if (checks && !details.contains(checks)) panel.appendChild(checks);

  // The original two-column rows can become partially empty after extraction.
  form.querySelectorAll(".form-row-2").forEach((row) => {
    if (!row.querySelector("input, select, textarea, button")) row.remove();
  });

  const primaryButton = form.querySelector("#wizardToQuestions") || form.querySelector("button[type='submit']");
  if (primaryButton) primaryButton.setAttribute("data-primary-action", "true");

  form.dataset.advancedSettingsEnhanced = "true";
}
