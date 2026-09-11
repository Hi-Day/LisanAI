function normalize(value) {
  return String(value || "").replace(/\r/g, "").split("\n").map((item) => item.trim()).filter(Boolean);
}

function syncTextarea(list, textarea, state) {
  const values = [...list.querySelectorAll("[data-outcome-input]")]
    .map((input) => input.value.trim())
    .filter(Boolean);
  textarea.value = values.join("\n");
  state.lastValue = textarea.value;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function createRow(list, textarea, state, value = "") {
  const row = document.createElement("div");
  row.className = "assessment-outcome-row";
  const index = list.children.length + 1;
  row.innerHTML = `<span class="assessment-outcome-index">${index}</span><input data-outcome-input type="text" value="" placeholder="Tuliskan capaian pembelajaran…" /><button type="button" class="assessment-outcome-remove" aria-label="Hapus capaian pembelajaran">×</button>`;
  const input = row.querySelector("[data-outcome-input]");
  input.value = value;
  input.addEventListener("input", () => syncTextarea(list, textarea, state));
  row.querySelector(".assessment-outcome-remove").addEventListener("click", () => {
    if (list.children.length <= 1) {
      input.value = "";
      syncTextarea(list, textarea, state);
      return;
    }
    row.remove();
    renumber(list);
    syncTextarea(list, textarea, state);
  });
  list.appendChild(row);
}

function renumber(list) {
  [...list.children].forEach((row, index) => {
    const number = row.querySelector(".assessment-outcome-index");
    if (number) number.textContent = String(index + 1);
  });
}

function render(list, textarea, state, values, max = 3) {
  const shown = values.slice(0, max);
  list.innerHTML = "";
  shown.forEach((value) => createRow(list, textarea, state, value));
  if (!list.children.length) createRow(list, textarea, state, "");
  textarea.value = shown.join("\n");
  state.lastValue = textarea.value;
}

function setGenerating(list, add, generating) {
  list.hidden = generating;
  add.hidden = generating;
}

function isGenerating(button) {
  return Boolean(button?.disabled || /membuat rekomendasi|membuat.*\.\.\.|generat.*\.\.\./i.test(button?.textContent || ""));
}

function validateCounts(list, questionCount) {
  const outcomes = [...list.querySelectorAll("[data-outcome-input]")]
    .map((input) => input.value.trim())
    .filter(Boolean);
  const questions = Math.max(0, Number(questionCount?.value || 0));
  if (!questions) return { valid: false, outcomes, questions, message: "Jumlah soal harus minimal 1." };
  if (outcomes.length > questions) {
    return {
      valid: false,
      outcomes,
      questions,
      message: `Ada ${outcomes.length} capaian pembelajaran tetapi hanya ${questions} soal. Tambahkan soal atau kurangi capaian pembelajaran menjadi maksimal ${questions}.`,
    };
  }
  return { valid: true, outcomes, questions, message: "" };
}

function installCountGuard(list) {
  const button = document.getElementById("wizardToQuestions");
  const questionCount = document.getElementById("questionCount");
  if (!button || !questionCount) return;

  const message = document.createElement("div");
  message.className = "assessment-outcomes-validation";
  message.setAttribute("role", "alert");
  message.hidden = true;
  list.after(message);

  const validate = () => {
    const result = validateCounts(list, questionCount);
    message.hidden = result.valid;
    message.textContent = result.message;
    return result.valid;
  };

  list.addEventListener("input", validate);
  questionCount.addEventListener("input", validate);
  questionCount.addEventListener("change", validate);

  button.addEventListener("click", (event) => {
    if (validate()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    list.querySelector("[data-outcome-input]:not([value])")?.focus();
    message.scrollIntoView({ behavior: "smooth", block: "center" });
  }, true);
}

function install() {
  const textarea = document.getElementById("outcomes");
  if (!textarea || textarea.dataset.outcomesListInstalled === "1") return false;

  const label = textarea.closest("label");
  if (!label) return false;
  textarea.dataset.outcomesListInstalled = "1";

  const state = { lastValue: textarea.value };
  const recommendationButton = document.getElementById("recommendOutcomes");

  // Keep the original label clean: the editable list becomes its only visible control.
  [...label.childNodes].forEach((node) => {
    if (node !== textarea) node.remove();
  });

  const heading = document.createElement("div");
  heading.className = "assessment-outcomes-heading";
  heading.innerHTML = `<div><strong>Kompetensi / capaian pembelajaran</strong><p>Tentukan kemampuan yang ingin dibuktikan dalam penilaian.</p></div>`;

  const list = document.createElement("div");
  list.className = "assessment-outcomes-list";
  list.setAttribute("role", "list");
  list.setAttribute("aria-label", "Daftar kompetensi atau capaian pembelajaran");

  const add = document.createElement("button");
  add.type = "button";
  add.className = "secondary-button assessment-outcome-add";
  add.textContent = "+ Tambah capaian";
  add.addEventListener("click", () => {
    createRow(list, textarea, state, "");
    renumber(list);
    list.lastElementChild?.querySelector("input")?.focus();
    syncTextarea(list, textarea, state);
  });

  textarea.classList.add("assessment-outcomes-source");
  textarea.setAttribute("aria-hidden", "true");
  textarea.tabIndex = -1;
  textarea.style.display = "none";

  label.append(heading, list, add, textarea);
  // New assessment starts with one empty editable placeholder, not a fake final LO.
  render(list, textarea, state, normalize(textarea.value), 3);
  installCountGuard(list);

  const refresh = () => {
    const generating = isGenerating(recommendationButton);
    setGenerating(list, add, generating);
    if (generating) return;
    if (textarea.value !== state.lastValue) {
      render(list, textarea, state, normalize(textarea.value), 3);
    }
  };

  recommendationButton?.addEventListener("click", () => {
    setGenerating(list, add, true);
  });

  const observer = new MutationObserver(refresh);
  observer.observe(recommendationButton || textarea, { attributes: true, childList: true, subtree: true, characterData: true });
  window.setInterval(refresh, 400);
  refresh();
  return true;
}

function installStyles() {
  if (document.getElementById("assessment-outcomes-ux-style")) return;
  const style = document.createElement("style");
  style.id = "assessment-outcomes-ux-style";
  style.textContent = `
    .wizard-panel[data-wizard-panel="1"] { padding: 28px 30px 30px; }
    .wizard-panel[data-wizard-panel="1"] > label { display: block; margin: 0 0 22px; }
    .wizard-panel[data-wizard-panel="1"] .inline-actions { margin: -4px 0 22px; display: flex; align-items: center; gap: 10px; }
    .wizard-panel[data-wizard-panel="1"] .assessment-core-grid { margin-top: 22px; gap: 16px; }
    .wizard-panel[data-wizard-panel="1"] .assessment-core-grid > label { margin: 0; }
    .assessment-outcomes-heading { margin: 0 0 12px; }
    .assessment-outcomes-heading strong { display: block; margin-bottom: 5px; }
    .assessment-outcomes-heading p { margin: 0; color: var(--muted); font-size: .9rem; line-height: 1.45; font-weight: 400; }
    .assessment-outcomes-list { display: grid; gap: 10px; }
    .assessment-outcomes-list[hidden], .assessment-outcome-add[hidden] { display: none; }
    .assessment-outcome-row { display: grid; grid-template-columns: 30px minmax(0, 1fr) 38px; gap: 10px; align-items: center; padding: 8px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); }
    .assessment-outcome-index { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: rgba(99, 102, 241, .10); font-weight: 700; font-size: .82rem; }
    .assessment-outcome-row input { width: 100%; min-width: 0; margin: 0; border: 0; background: transparent; box-shadow: none; padding: 8px 4px; font: inherit; font-weight: 600; }
    .assessment-outcome-row input:focus { outline: none; box-shadow: none; }
    .assessment-outcome-remove { width: 34px; height: 34px; border: 0; border-radius: 9px; background: transparent; color: var(--muted); font-size: 1.25rem; cursor: pointer; }
    .assessment-outcome-remove:hover { background: rgba(180, 35, 24, .08); color: #b42318; }
    .assessment-outcome-add { margin-top: 10px; width: 100%; min-height: 42px; }
    .assessment-outcomes-validation { margin-top: 10px; padding: 10px 12px; border: 1px solid rgba(180, 35, 24, .25); border-radius: 10px; background: rgba(180, 35, 24, .06); color: #8f1d15; font-size: .88rem; line-height: 1.45; }
    .assessment-advanced-settings { margin-top: 24px; }
    @media (max-width: 639px) {
      .wizard-panel[data-wizard-panel="1"] { padding: 22px 18px 24px; }
      .wizard-panel[data-wizard-panel="1"] .assessment-core-grid { gap: 12px; }
      .assessment-outcome-row { grid-template-columns: 28px minmax(0, 1fr) 34px; gap: 7px; padding: 7px; }
    }
  `;
  document.head.appendChild(style);
}

function start() {
  installStyles();
  install();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
