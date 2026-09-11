const DEFAULT_OUTCOMES = [
  "Siswa mampu menjelaskan konsep utama pada materi dengan bahasa sendiri.",
  "Siswa mampu menghubungkan konsep dengan situasi atau contoh yang relevan.",
  "Siswa mampu menjelaskan alasan atau proses berpikir secara runtut dalam jawaban lisan.",
];

function normalize(value) {
  return String(value || "").replace(/\r/g, "").split("\n").map((item) => item.trim()).filter(Boolean);
}

function syncTextarea(list, textarea) {
  textarea.value = [...list.querySelectorAll("[data-outcome-input]")].map((input) => input.value.trim()).filter(Boolean).join("\n");
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function createRow(list, textarea, value = "") {
  const row = document.createElement("div");
  row.className = "assessment-outcome-row";
  const index = list.children.length + 1;
  row.innerHTML = `<span class="assessment-outcome-index">${index}</span><input data-outcome-input type="text" value="" placeholder="Tuliskan capaian pembelajaran…" /><button type="button" class="assessment-outcome-remove" aria-label="Hapus capaian pembelajaran">×</button>`;
  const input = row.querySelector("[data-outcome-input]");
  input.value = value;
  input.addEventListener("input", () => syncTextarea(list, textarea));
  row.querySelector(".assessment-outcome-remove").addEventListener("click", () => {
    if (list.children.length <= 1) return;
    row.remove();
    renumber(list);
    syncTextarea(list, textarea);
  });
  list.appendChild(row);
}

function renumber(list) {
  [...list.children].forEach((row, index) => {
    const number = row.querySelector(".assessment-outcome-index");
    if (number) number.textContent = String(index + 1);
  });
}

function render(list, textarea, values) {
  list.innerHTML = "";
  const initial = values.length ? values : DEFAULT_OUTCOMES;
  initial.slice(0, 3).forEach((value) => createRow(list, textarea, value));
  if (!initial.length) createRow(list, textarea, "");
  syncTextarea(list, textarea);
}

function install() {
  const textarea = document.getElementById("outcomes");
  if (!textarea || textarea.dataset.outcomesListInstalled === "1") return false;

  textarea.dataset.outcomesListInstalled = "1";
  const label = textarea.closest("label");
  if (!label) return false;

  const heading = document.createElement("div");
  heading.className = "assessment-outcomes-heading";
  heading.innerHTML = `<div><strong>Kompetensi / capaian pembelajaran</strong><p>Definisikan kemampuan yang harus dapat dibuktikan siswa. Default 3 capaian; masing-masing bisa diedit atau dihapus.</p></div>`;

  const list = document.createElement("div");
  list.className = "assessment-outcomes-list";
  list.setAttribute("role", "list");

  const add = document.createElement("button");
  add.type = "button";
  add.className = "secondary-button assessment-outcome-add";
  add.textContent = "+ Tambah capaian";
  add.addEventListener("click", () => {
    createRow(list, textarea, "");
    renumber(list);
    list.lastElementChild?.querySelector("input")?.focus();
    syncTextarea(list, textarea);
  });

  textarea.classList.add("assessment-outcomes-source");
  textarea.setAttribute("aria-hidden", "true");
  textarea.tabIndex = -1;
  textarea.style.display = "none";

  label.insertBefore(heading, textarea);
  label.insertBefore(list, textarea);
  label.insertBefore(add, textarea);
  render(list, textarea, normalize(textarea.value));

  // Recommendation writes directly to the legacy textarea. Detect that value
  // change without requiring changes to the existing recommendation flow.
  let lastValue = textarea.value;
  window.setInterval(() => {
    if (textarea.value === lastValue) return;
    lastValue = textarea.value;
    const values = normalize(textarea.value);
    if (values.length) render(list, textarea, values);
  }, 250);

  return true;
}

function installStyles() {
  if (document.getElementById("assessment-outcomes-ux-style")) return;
  const style = document.createElement("style");
  style.id = "assessment-outcomes-ux-style";
  style.textContent = `
    .wizard-panel[data-wizard-panel="1"] { padding: 28px 30px 30px; }
    .wizard-panel[data-wizard-panel="1"] > label { display: block; margin: 0 0 22px; }
    .wizard-panel[data-wizard-panel="1"] > label:last-of-type { margin-bottom: 0; }
    .wizard-panel[data-wizard-panel="1"] .inline-actions { margin: -6px 0 22px; display: flex; align-items: center; }
    .wizard-panel[data-wizard-panel="1"] .inline-actions .secondary-button { min-height: 48px; }
    .wizard-panel[data-wizard-panel="1"] .assessment-core-grid { margin-top: 22px; gap: 16px; }
    .wizard-panel[data-wizard-panel="1"] .assessment-core-grid > label { margin: 0; }
    .assessment-outcomes-heading { margin: 0 0 12px; }
    .assessment-outcomes-heading strong { display: block; margin-bottom: 5px; }
    .assessment-outcomes-heading p { margin: 0; color: var(--muted); font-size: .9rem; line-height: 1.45; font-weight: 400; }
    .assessment-outcomes-list { display: grid; gap: 10px; }
    .assessment-outcome-row { display: grid; grid-template-columns: 30px minmax(0, 1fr) 38px; gap: 10px; align-items: center; padding: 8px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); }
    .assessment-outcome-index { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: rgba(99, 102, 241, .10); font-weight: 700; font-size: .82rem; }
    .assessment-outcome-row input { width: 100%; min-width: 0; margin: 0; border: 0; background: transparent; box-shadow: none; padding: 8px 4px; }
    .assessment-outcome-row input:focus { outline: none; box-shadow: none; }
    .assessment-outcome-remove { width: 34px; height: 34px; border: 0; border-radius: 9px; background: transparent; color: var(--muted); font-size: 1.25rem; cursor: pointer; }
    .assessment-outcome-remove:hover { background: rgba(180, 35, 24, .08); color: #b42318; }
    .assessment-outcome-add { margin-top: 10px; width: 100%; min-height: 42px; }
    .assessment-advanced-settings { margin-top: 24px; }
    @media (max-width: 639px) {
      .wizard-panel[data-wizard-panel="1"] { padding: 22px 18px 24px; }
      .wizard-panel[data-wizard-panel="1"] .assessment-core-grid { gap: 12px; }
      .assessment-outcome-row { grid-template-columns: 28px minmax(0, 1fr) 34px; gap: 7px; padding: 7px; }
    }
    @media (prefers-reduced-motion: reduce) { .assessment-outcome-row { transition: none !important; } }
  `;
  document.head.appendChild(style);
}

function start() {
  installStyles();
  install();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
