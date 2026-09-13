function getCsrfToken() {
  return fetch("/api/auth?action=me", { credentials: "include" })
    .then((response) => response.json())
    .then((data) => data.csrfToken || "");
}

function parseSseChunk(buffer, onEvent) {
  const parts = buffer.split("\n\n");
  const remainder = parts.pop() || "";
  parts.forEach((part) => {
    const line = part.split("\n").find((item) => item.startsWith("data: "));
    if (!line) return;
    try { onEvent(JSON.parse(line.slice(6))); } catch { /* ignore incomplete event */ }
  });
  return remainder;
}

async function streamOutcomes(payload, onEvent) {
  const csrfToken = await getCsrfToken();
  const response = await fetch("/api/assessment", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: JSON.stringify({ action: "recommend-learning-outcomes", stream: true, payload }),
  });
  if (!response.ok) {
    let message = `AI gagal (${response.status})`;
    try { message = (await response.json()).error || message; } catch { /* noop */ }
    throw new Error(message);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Streaming tidak tersedia pada browser ini.");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    buffer = parseSseChunk(buffer, onEvent);
    if (done) break;
  }
  if (buffer.trim()) parseSseChunk(`${buffer}\n\n`, onEvent);
}

function install() {
  const textarea = document.getElementById("outcomes");
  const list = document.querySelector(".assessment-outcomes-list");
  const recommend = document.getElementById("recommendOutcomes");
  const addManual = document.querySelector(".assessment-outcome-add");
  if (!textarea || !list || !recommend || !addManual || recommend.dataset.parallelAiInstalled === "1") return false;
  recommend.dataset.parallelAiInstalled = "1";

  const aiAdd = document.createElement("button");
  aiAdd.type = "button";
  aiAdd.className = "secondary-button assessment-outcome-add-ai";
  aiAdd.textContent = "✨ Tambah dengan AI";
  addManual.after(aiAdd);

  function values() {
    return [...list.querySelectorAll("[data-outcome-input]")].map((input) => input.value.trim()).filter(Boolean);
  }

  function topic() { return document.getElementById("topic")?.value?.trim() || ""; }

  function makeStreamPanel(count, mode) {
    const panel = document.createElement("div");
    panel.className = "assessment-outcome-ai-stream";
    panel.innerHTML = `<div class="assessment-outcome-ai-title"><span class="assessment-outcome-ai-spinner" aria-hidden="true"></span><div><strong>${mode === "add" ? "AI sedang menambahkan kompetensi…" : "AI sedang membuat 3 kompetensi…"}</strong><small>Setiap kompetensi dibuat dan dialirkan secara paralel.</small></div></div><div class="assessment-outcome-ai-items"></div>`;
    const items = panel.querySelector(".assessment-outcome-ai-items");
    for (let i = 0; i < count; i += 1) {
      const row = document.createElement("div");
      row.className = "assessment-outcome-ai-item";
      row.dataset.index = String(i);
      row.innerHTML = `<span class="assessment-outcome-ai-number">${i + 1}</span><div><div class="assessment-outcome-ai-text">Menunggu…</div><small class="assessment-outcome-ai-status">Menunggu stream</small></div>`;
      items.appendChild(row);
    }
    list.before(panel);
    return panel;
  }

  function updateStreamRow(panel, event) {
    const row = panel.querySelector(`.assessment-outcome-ai-item[data-index="${event.index}"]`);
    if (!row) return;
    const text = row.querySelector(".assessment-outcome-ai-text");
    const status = row.querySelector(".assessment-outcome-ai-status");
    if (event.type === "outcome-start") status.textContent = "Membuat kompetensi…";
    if (event.type === "outcome-chunk") { text.textContent = event.text || ""; status.textContent = "Sedang mengalir…"; }
    if (event.type === "outcome-result") { text.textContent = event.outcome || ""; status.textContent = "✓ Selesai"; row.classList.add("is-complete"); }
    if (event.type === "outcome-error") { text.textContent = event.outcome || ""; status.textContent = "Menggunakan hasil cadangan"; row.classList.add("is-complete"); }
  }

  function syncList(outcomes) {
    list.innerHTML = "";
    outcomes.forEach((outcome) => {
      const row = document.createElement("div");
      row.className = "assessment-outcome-row";
      row.innerHTML = `<span class="assessment-outcome-index">${list.children.length + 1}</span><input data-outcome-input type="text" placeholder="Tuliskan capaian pembelajaran…"><button type="button" class="assessment-outcome-remove" aria-label="Hapus capaian pembelajaran">×</button>`;
      const input = row.querySelector("input");
      input.value = outcome;
      input.addEventListener("input", () => {
        textarea.value = [...list.querySelectorAll("[data-outcome-input]")].map((node) => node.value.trim()).filter(Boolean).join("\n");
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      });
      row.querySelector("button").addEventListener("click", () => {
        if (list.children.length <= 1) input.value = "";
        else row.remove();
        [...list.children].forEach((node, index) => { node.querySelector(".assessment-outcome-index").textContent = String(index + 1); });
        textarea.value = [...list.querySelectorAll("[data-outcome-input]")].map((node) => node.value.trim()).filter(Boolean).join("\n");
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      });
      list.appendChild(row);
    });
    textarea.value = outcomes.join("\n");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  async function generate(mode) {
    const existing = values();
    const count = mode === "add" ? 1 : 3;
    if (mode === "add" && !topic()) {
      window.alert("Isi topik atau materi terlebih dahulu.");
      return;
    }
    const panel = makeStreamPanel(count, mode);
    recommend.disabled = true;
    aiAdd.disabled = true;
    addManual.disabled = true;
    try {
      const generated = [];
      await streamOutcomes({ topic: topic(), outcomes: textarea.value.trim(), existingOutcomes: existing, count }, (event) => {
        updateStreamRow(panel, event);
        if (event.type === "outcome-result" || event.type === "outcome-error") generated[event.index] = event.outcome;
      });
      const clean = generated.filter(Boolean);
      if (mode === "add") syncList([...existing, ...clean].slice(0, Math.max(1, Number(document.getElementById("questionCount")?.value || 999))));
      else syncList(clean.slice(0, 3));
      panel.querySelector(".assessment-outcome-ai-title strong").textContent = mode === "add" ? "Kompetensi berhasil ditambahkan" : "3 kompetensi selesai dibuat";
      panel.querySelector(".assessment-outcome-ai-spinner")?.remove();
      window.setTimeout(() => panel.remove(), 900);
    } catch (error) {
      panel.querySelector(".assessment-outcome-ai-title strong").textContent = "AI tidak dapat membuat kompetensi";
      panel.querySelector(".assessment-outcome-ai-title small").textContent = error.message;
      panel.querySelector(".assessment-outcome-ai-spinner")?.remove();
    } finally {
      recommend.disabled = false;
      aiAdd.disabled = false;
      addManual.disabled = false;
    }
  }

  recommend.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    generate("replace");
  }, true);
  aiAdd.addEventListener("click", () => generate("add"));
  return true;
}

function installStyles() {
  if (document.getElementById("assessment-outcomes-ai-style")) return;
  const style = document.createElement("style");
  style.id = "assessment-outcomes-ai-style";
  style.textContent = `
    .assessment-outcome-add-ai { width: 100%; min-height: 42px; margin-top: 8px; }
    .assessment-outcome-ai-stream { margin: 12px 0; padding: 14px; border: 1px solid var(--line); border-radius: 14px; background: var(--panel); }
    .assessment-outcome-ai-title { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 12px; }
    .assessment-outcome-ai-title strong { display: block; line-height: 1.35; }
    .assessment-outcome-ai-title small { display: block; margin-top: 3px; color: var(--muted); line-height: 1.4; }
    .assessment-outcome-ai-spinner { width: 18px; height: 18px; flex: 0 0 18px; border: 2px solid var(--line); border-top-color: currentColor; border-radius: 50%; animation: assessmentOutcomeSpin 1.8s linear infinite; }
    .assessment-outcome-ai-items { display: grid; gap: 8px; }
    .assessment-outcome-ai-item { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 9px; padding: 9px; border-radius: 10px; background: rgba(99,102,241,.05); }
    .assessment-outcome-ai-number { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: rgba(99,102,241,.10); font-size: .78rem; font-weight: 700; }
    .assessment-outcome-ai-text { min-height: 20px; line-height: 1.45; font-weight: 600; }
    .assessment-outcome-ai-status { color: var(--muted); font-size: .76rem; }
    .assessment-outcome-ai-item.is-complete { background: rgba(16, 185, 129, .06); }
    @keyframes assessmentOutcomeSpin { to { transform: rotate(360deg); } }
    @media (max-width: 639px) { .assessment-outcome-ai-stream { padding: 12px; } }
  `;
  document.head.appendChild(style);
}

function start() {
  installStyles();
  install();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
