const DEMAND_PATTERNS = {
  identification: /\b(?:identifikasi|pilih|tentukan|sebutkan|nama(?:kan)?|menentukan|memilih)\b/i,
  reasoning: /\b(?:mengapa|kenapa|alasan|jelaskan\s+(?:mengapa|alasan|pilihan|hubungan|proses)|uraikan\s+alasan|argumentasi|argumen)\b/i,
  application: /\b(?:contoh|misal|misalnya|penerapan|diterapkan|kasus|situasi konkret|situasi)\b/i,
  comparison: /\b(?:bandingkan|perbandingan|persamaan|perbedaan|berbeda)\b/i,
  analysis: /\b(?:analisis|analisa|hubungan sebab|sebab-akibat|menghubungkan|hubungkan|dampak|pengaruh)\b/i,
  evaluation: /\b(?:evaluasi|nilai|menilai|kritisi|kritik|kelebihan|kelemahan|batasan)\b/i,
  procedure: /\b(?:langkah|prosedur|cara|tahapan|proses)\b/i,
};

const CRITERION_DEMANDS = [
  { type: "application", pattern: /\b(?:contoh|penerapan|kasus|situasi)\b/i, label: "contoh/penerapan" },
  { type: "comparison", pattern: /\b(?:banding|perbandingan|persamaan|perbedaan)\b/i, label: "perbandingan" },
  { type: "analysis", pattern: /\b(?:analisis|sebab|akibat|dampak|pengaruh|hubungan)\b/i, label: "analisis/sebab-akibat" },
  { type: "evaluation", pattern: /\b(?:evaluasi|menilai|kritik|kelebihan|kelemahan|batasan)\b/i, label: "evaluasi" },
  { type: "reasoning", pattern: /\b(?:alasan|argument|argumen|kedalaman)\b/i, label: "alasan/argumentasi" },
  { type: "procedure", pattern: /\b(?:langkah|prosedur|cara|tahapan|proses)\b/i, label: "prosedur" },
  { type: "identification", pattern: /\b(?:identifikasi|ketepatan|pemilihan|menyebut|nama)\b/i, label: "identifikasi" },
];

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function inferCriterionDemand(name) {
  return CRITERION_DEMANDS.find((entry) => entry.pattern.test(normalizeText(name).toLowerCase())) || null;
}

function criterionGrounding(prompt, criterionName) {
  const demand = inferCriterionDemand(criterionName);
  if (!demand) return { grounded: true, demand: null };
  return { grounded: Boolean(DEMAND_PATTERNS[demand.type]?.test(normalizeText(prompt))), demand };
}

function collectQuestions() {
  const bridge = window.__lisanAssessmentWizardBridge;
  const wizardQuestions = bridge?.ctx?.pendingQuestions || [];
  return [...document.querySelectorAll("#editableQuestionList .editable-question")].map((card, index) => {
    const prompt = normalizeText(card.querySelector("[data-field='prompt']")?.value);
    const source = wizardQuestions[index] || {};
    const chip = card.querySelector(".q-criteria-chip")?.textContent || "";
    const criteriaText = chip.replace(/^Rubrik yang diukur soal ini:\s*/i, "").trim();
    const chipCriteria = criteriaText ? criteriaText.split(/\s+·\s+/).map(normalizeText).filter(Boolean) : [];
    const criteria = Array.isArray(source.criteria) && source.criteria.length ? source.criteria : chipCriteria;
    return {
      index,
      prompt,
      focus: normalizeText(card.querySelector("[data-field='focus']")?.value),
      outcome: normalizeText(card.querySelector("[data-field='outcome']")?.value),
      ideal: normalizeText(card.querySelector("[data-field='ideal']")?.value),
      rubric: source.rubric || card.querySelector(".rubrik-preview")?.textContent || "",
      criteria,
      probing: Boolean(card.querySelector("[data-field='probing']")?.checked ?? source.probing),
      card,
    };
  });
}

function validateQuestions() {
  const issues = [];
  for (const q of collectQuestions()) {
    if (!q.prompt) {
      issues.push({ index: q.index, type: "empty", message: `Soal ${q.index + 1} belum memiliki pertanyaan.` });
      continue;
    }
    for (const criterion of q.criteria) {
      const name = typeof criterion === "string" ? criterion : criterion?.name || criterion?.id || "";
      const result = criterionGrounding(q.prompt, name);
      if (!result.grounded) {
        issues.push({ index: q.index, type: "ungrounded", criterion: name, demand: result.demand?.label || "evidence spesifik", message: `Soal ${q.index + 1}: criterion “${name}” membutuhkan ${result.demand?.label || "evidence spesifik"}, tetapi pertanyaannya belum memintanya.` });
      }
    }
  }
  return { valid: issues.length === 0, issues };
}

function installStyles() {
  if (document.getElementById("lisan-pedagogical-gate-style")) return;
  const style = document.createElement("style");
  style.id = "lisan-pedagogical-gate-style";
  style.textContent = `
    .pedagogical-gate { margin: 16px 0; padding: 16px 18px; border: 1px solid var(--line); border-radius: 14px; background: var(--panel); }
    .pedagogical-gate.is-blocked { border-color: #d99a38; background: color-mix(in srgb, var(--panel) 88%, #d99a38 12%); }
    .pedagogical-gate.is-passed { border-color: #72a879; }
    .pedagogical-gate h4 { margin: 0 0 6px; }
    .pedagogical-gate p { margin: 0 0 10px; color: var(--muted); line-height: 1.5; }
    .pedagogical-gate ul { margin: 8px 0 0 20px; padding: 0; }
    .pedagogical-gate li { margin: 6px 0; line-height: 1.45; }
    .pedagogical-gate .gate-actions { display: grid; gap: 8px; margin-top: 14px; }
    .pedagogical-gate .gate-actions button { width: 100%; }
    .pedagogical-gate .gate-action { margin-top: 12px; font-size: .9rem; }
    .pedagogical-gate .gate-repair-status { margin-top: 10px; font-size: .9rem; }
    .pedagogical-gate .gate-repair-stream { margin-top: 12px; padding: 12px; border: 1px solid var(--line); border-radius: 11px; background: var(--panel); }
    .pedagogical-gate .repair-stream-label { font-weight: 700; margin-bottom: 8px; }
    .pedagogical-gate .repair-stream-text { color: var(--muted); white-space: pre-wrap; word-break: break-word; line-height: 1.5; font-size: .88rem; }
    .pedagogical-gate .repair-stream-item { padding: 8px 0; border-top: 1px solid var(--line); }
    .pedagogical-gate .repair-stream-item strong { display: block; margin-bottom: 4px; }
    .pedagogical-gate .repair-stream-item span { display: block; line-height: 1.5; }
    .pedagogical-gate .repair-stream-caret { display: inline-block; width: 7px; height: 16px; margin-left: 4px; vertical-align: middle; border-radius: 2px; background: currentColor; opacity: .55; animation: pedagogicalStreamCaret 1.4s ease-in-out infinite; }
    @keyframes pedagogicalStreamCaret { 0%, 45% { opacity: .15; } 50%, 100% { opacity: .65; } }
    .pedagogical-gate .repair-preview { margin-top: 14px; display: grid; gap: 10px; }
    .pedagogical-gate .repair-card { padding: 12px; border: 1px solid var(--line); border-radius: 11px; }
    .pedagogical-gate .repair-card.before { background: color-mix(in srgb, var(--panel) 94%, #b42318 6%); }
    .pedagogical-gate .repair-card.after { background: color-mix(in srgb, var(--panel) 94%, #027a48 6%); }
    .pedagogical-gate .repair-card strong { display: block; margin-bottom: 6px; }
    .pedagogical-gate .repair-card p { margin: 4px 0 0; font-size: .9rem; }
    .pedagogical-gate .repair-meta { margin-top: 8px; font-size: .82rem; color: var(--muted); }
    .pedagogical-gate .repair-apply-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    .pedagogical-gate .repair-apply-row button { flex: 1 1 180px; }
    .pedagogical-gate .repair-question-pair { display: grid; gap: 10px; }
    .pedagogical-gate .repair-stream-output { min-height: 48px; line-height: 1.55; white-space: normal; }
    .pedagogical-gate .repair-stream-placeholder { color: var(--muted); font-style: italic; }
    .pedagogical-gate .repair-stream-meta { min-height: 18px; }
    .pedagogical-gate .repair-stream-error { color: #b42318; }
    @media (min-width: 640px) { .pedagogical-gate .gate-actions { grid-template-columns: 1.25fr 1fr 1fr; } .pedagogical-gate .repair-preview { grid-template-columns: 1fr 1fr; } .pedagogical-gate .repair-question-pair { grid-template-columns: 1fr 1fr; } }
    @media (prefers-reduced-motion: reduce) { .pedagogical-gate * { scroll-behavior: auto !important; animation: none !important; } }
  `;
  document.head.appendChild(style);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function questionSummary(question) {
  const criteria = Array.isArray(question?.criteria) ? question.criteria : [];
  const names = criteria.map((criterion) => typeof criterion === "string" ? criterion : criterion?.name || criterion?.id || "").filter(Boolean);
  return names.length ? `Criterion: ${names.join(" · ")}` : "Criterion tidak berubah / tidak tersedia";
}

function buildChanges(beforeQuestions, afterQuestions) {
  return afterQuestions.map((after, index) => {
    const before = beforeQuestions[index] || {};
    const beforeCriteria = JSON.stringify(before.criteria || []);
    const afterCriteria = JSON.stringify(after.criteria || []);
    const changed = normalizeText(before.prompt) !== normalizeText(after.prompt) || beforeCriteria !== afterCriteria || normalizeText(before.rubric) !== normalizeText(after.rubric);
    return changed ? { questionIndex: index, before: { prompt: before.prompt || "", rubricSummary: questionSummary(before) }, after: { prompt: after.prompt || "", rubricSummary: questionSummary(after) } } : null;
  }).filter(Boolean);
}

function renderGate(container, result, mode = "review") {
  if (!container) return;
  const existing = container.querySelector(":scope > .pedagogical-gate");
  if (existing) existing.remove();
  const gate = document.createElement("section");
  gate.className = `pedagogical-gate ${result.valid ? "is-passed" : "is-blocked"}`;
  gate.setAttribute("role", result.valid ? "status" : "alert");
  if (result.valid) {
    gate.innerHTML = `<h4>✓ Quality Gate: evidence grounded</h4><p>Setiap criterion yang terhubung ke soal memiliki tuntutan evidence yang dapat ditelusuri dari pertanyaan. Assessment siap ditinjau${mode === "publish" ? " dan dipublish" : ""}.</p>`;
  } else {
    gate.innerHTML = `<h4>⚠ Quality Gate: perlu diperbaiki</h4><p>${result.issues.length} masalah grounding ditemukan. AI dapat memperbaikinya tanpa memaksakan evidence baru.</p><ul>${result.issues.map((issue) => `<li>${escapeHtml(issue.message)}</li>`).join("")}</ul><div class="gate-actions"><button type="button" class="primary-button pedagogical-repair-btn" data-repair-mode="auto">✨ Perbaiki dengan AI</button><button type="button" class="secondary-button pedagogical-repair-btn" data-repair-mode="question">↻ Regenerate soal</button><button type="button" class="secondary-button pedagogical-repair-btn" data-repair-mode="rubric">⚖ Sesuaikan rubrik</button></div><p class="gate-repair-status" aria-live="polite"></p><div class="gate-repair-stream" aria-live="polite"></div><div class="gate-repair-preview"></div><p class="gate-action"><strong>Prinsip:</strong> jika criterion memang penting, AI memperjelas permintaan evidence pada soal. Jika tidak, AI menyesuaikan rubric agar tidak menilai hal yang tidak ditanyakan.</p>`;
  }
  container.prepend(gate);
}

function showGateAtQuestionEditor(result) {
  const editor = document.getElementById("questionEditor");
  if (editor) renderGate(editor, result, "review");
  const firstIssue = result.issues[0];
  const questions = collectQuestions();
  const card = firstIssue ? questions[firstIssue.index]?.card : null;
  card?.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function getCsrfToken() {
  const response = await fetch("/api/auth?action=me", { credentials: "include" });
  const data = await response.json();
  if (!response.ok || !data.csrfToken) throw new Error(data.error || "Session tidak valid.");
  return data.csrfToken;
}

async function requestRepair(mode, result, gate) {
  const bridge = window.__lisanAssessmentWizardBridge;
  if (!bridge?.ctx) throw new Error("Assessment wizard belum siap.");
  bridge.sync();
  const ctx = bridge.ctx;
  const beforeQuestions = (ctx.pendingQuestions || []).map((question) => ({ ...question, criteria: Array.isArray(question.criteria) ? question.criteria.map((c) => ({ ...c })) : [] }));
  const domQuestions = collectQuestions();
  const questions = beforeQuestions.map((question, index) => ({ ...question, prompt: domQuestions[index]?.prompt || question.prompt, focus: domQuestions[index]?.focus || question.focus, outcome: domQuestions[index]?.outcome || question.outcome, ideal: domQuestions[index]?.ideal || question.ideal }));
  const affectedIndexes = [...new Set((result.issues || []).map((issue) => Number(issue.index ?? issue.questionIndex)).filter((index) => Number.isInteger(index) && index >= 0 && index < questions.length))].sort((a, b) => a - b);
  const host = gate?.querySelector(".gate-repair-preview");
  if (!host) throw new Error("Panel preview repair tidak ditemukan.");
  host.innerHTML = `<div class="repair-meta">AI memperbaiki soal yang terdampak secara paralel. Soal sebelum langsung ditampilkan; hasil sesudah muncul saat token AI diterima.</div><div class="repair-preview repair-preview-streaming"></div>`;
  const preview = host.querySelector(".repair-preview-streaming");
  const afterNodes = new Map();
  const afterQuestions = [...questions];
  for (const index of affectedIndexes) {
    const question = questions[index];
    const card = document.createElement("article");
    card.className = "repair-question-pair";
    card.innerHTML = `<div class="repair-card before"><strong>Sebelum — Soal ${index + 1}</strong><div>${escapeHtml(question.prompt || "")}</div><p>${escapeHtml(questionSummary(question))}</p></div><div class="repair-card after"><strong>Sesudah — Soal ${index + 1}</strong><div class="repair-stream-output" data-question-index="${index}"><span class="repair-stream-placeholder">✨ AI sedang menyiapkan soal...</span></div><p class="repair-stream-meta">Menunggu stream AI…</p></div>`;
    preview.appendChild(card);
    afterNodes.set(index, { output: card.querySelector(".repair-stream-output"), meta: card.querySelector(".repair-stream-meta") });
  }
  const applyRow = document.createElement("div");
  applyRow.className = "repair-apply-row";
  applyRow.innerHTML = `<button type="button" class="primary-button apply-repair" disabled>✓ Terapkan semua perubahan</button><button type="button" class="secondary-button reject-repair">Tolak</button>`;
  host.appendChild(applyRow);
  const topic = document.getElementById("topic")?.value?.trim() || ctx.pendingAssessmentConfig?.topic || "";
  const outcomes = document.getElementById("outcomes")?.value?.trim() || ctx.pendingAssessmentConfig?.outcomes || "";
  const csrfToken = await getCsrfToken();
  const extractPrompt = (text) => {
    const raw = String(text || "");
    const marker = /"prompt"\s*:\s*"/i.exec(raw);
    if (!marker) return "";
    const startAt = marker.index + marker[0].length;
    let escaped = false;
    let value = "";
    for (let i = startAt; i < raw.length; i += 1) {
      const char = raw[i];
      if (escaped) { value += char === "n" ? "\n" : char === "r" ? "\r" : char === "t" ? "\t" : char; escaped = false; }
      else if (char === "\\") escaped = true;
      else if (char === '"') break;
      else value += char;
    }
    return value;
  };
  const parseSse = async (response, index) => {
    if (!response.ok) { const errorData = await response.json().catch(() => ({})); throw new Error(errorData.error || `AI gagal memperbaiki Soal ${index + 1}.`); }
    if (!response.body) throw new Error("Browser tidak mendukung streaming AI.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamedText = "";
    let finalData = null;
    const updateOutput = () => {
      const nodes = afterNodes.get(index);
      if (!nodes) return;
      const prompt = extractPrompt(streamedText);
      if (prompt) { nodes.output.innerHTML = escapeHtml(prompt).replace(/\n/g, "<br>"); nodes.meta.textContent = `✨ AI sedang menyusun Soal ${index + 1}…`; }
      else if (streamedText.trim()) { nodes.output.innerHTML = `<span class="repair-stream-placeholder">✨ AI sedang menyusun…</span>`; nodes.meta.textContent = "Menerima output AI…"; }
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";
      for (const event of events) {
        const line = event.split("\n").find((item) => item.startsWith("data: "));
        if (!line) continue;
        let packet;
        try { packet = JSON.parse(line.slice(6)); } catch { continue; }
        if (packet.type === "chunk") { streamedText += packet.text || ""; updateOutput(); }
        else if (packet.type === "result") finalData = packet.data;
        else if (packet.type === "error") throw new Error(packet.message || `AI gagal memperbaiki Soal ${index + 1}.`);
      }
    }
    if (!finalData?.questions?.[0]) throw new Error(`AI tidak mengembalikan hasil untuk Soal ${index + 1}.`);
    const repaired = finalData.questions[0];
    afterQuestions[index] = { ...questions[index], ...repaired, id: questions[index]?.id || repaired.id, probing: questions[index]?.probing ?? repaired.probing };
    const nodes = afterNodes.get(index);
    if (nodes) { nodes.output.innerHTML = escapeHtml(afterQuestions[index].prompt || "Tidak ada prompt yang dikembalikan.").replace(/\n/g, "<br>"); nodes.meta.textContent = `✓ Selesai · ${finalData.repairedBy === "ai" ? "AI" : "AI + pemeriksaan deterministik"} · ${questionSummary(afterQuestions[index])}`; }
  };
  const results = await Promise.all(affectedIndexes.map(async (index) => {
    const nodes = afterNodes.get(index);
    if (nodes) nodes.meta.textContent = `⏳ Memproses Soal ${index + 1}…`;
    try {
      const response = await fetch("/api/assessment", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken }, body: JSON.stringify({ action: "repair-pedagogical-grounding", stream: true, payload: { mode, topic, outcomes, issues: (result.issues || []).filter((issue) => Number(issue.index ?? issue.questionIndex) === index), questions: [questions[index]] } }) });
      await parseSse(response, index);
      return true;
    } catch (error) {
      const node = afterNodes.get(index);
      if (node) { node.output.innerHTML = `<span class="repair-stream-error">⚠ ${escapeHtml(error.message)}</span>`; node.meta.textContent = "Gagal diproses."; }
      return false;
    }
  }));
  const failed = results.some((ok) => !ok);
  const applyButton = applyRow.querySelector(".apply-repair");
  if (!failed) {
    applyButton.disabled = false;
    applyButton.addEventListener("click", () => {
      const wizard = window.__lisanAssessmentWizardBridge;
      if (!wizard?.ctx) return;
      wizard.ctx.pendingQuestions = afterQuestions;
      wizard.render();
      const nextResult = validateQuestions();
      showGateAtQuestionEditor(nextResult);
      const status = document.querySelector(".pedagogical-gate .gate-repair-status");
      if (status) status.textContent = nextResult.valid ? "✓ Semua perubahan diterapkan dan Quality Gate lulus." : "⚠ Perubahan diterapkan, tetapi masih ada masalah yang perlu ditinjau.";
    });
  } else { applyButton.textContent = "⚠ Ada soal yang gagal — coba lagi"; applyButton.disabled = true; }
  host.querySelector(".reject-repair").addEventListener("click", () => {
    host.innerHTML = "<p class=\"gate-repair-status\">Perubahan AI ditolak. Soal dan rubrik tetap seperti semula.</p>";
    gate.querySelectorAll(".pedagogical-repair-btn").forEach((button) => { button.disabled = false; });
  });
  return { data: { repairedBy: failed ? "partial-error" : "ai" }, beforeQuestions, afterQuestions };
}

function install() {
  installStyles();
  document.addEventListener("click", async (event) => {
    const reviewButton = event.target.closest("#wizardToReview");
    const publishButton = event.target.closest("#saveQuestionSet");
    const repairButton = event.target.closest(".pedagogical-repair-btn");
    if (repairButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const mode = repairButton.dataset.repairMode || "auto";
      const gate = repairButton.closest(".pedagogical-gate");
      const result = validateQuestions();
      if (!gate || result.valid) return;
      const buttons = gate.querySelectorAll("button");
      buttons.forEach((button) => { button.disabled = true; });
      repairButton.textContent = mode === "question" ? "↻ AI memperbaiki soal..." : mode === "rubric" ? "⚖ AI menyesuaikan rubrik..." : "✨ AI sedang memperbaiki...";
      const status = gate.querySelector(".gate-repair-status");
      if (status) status.textContent = "Menganalisis masalah dan menyiapkan rekomendasi. Soal belum diubah.";
      try {
        await requestRepair(mode, result, gate);
        if (status) status.textContent = "✓ Rekomendasi siap ditinjau.";
      } catch (error) {
        if (status) status.textContent = `⚠ ${error.message}`;
        buttons.forEach((button) => { button.disabled = false; });
      }
      return;
    }
    if (!reviewButton && !publishButton) return;
    const result = validateQuestions();
    if (!result.valid) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showGateAtQuestionEditor(result);
      return;
    }
    if (publishButton) {
      const review = document.getElementById("reviewSummary");
      renderGate(review, result, "publish");
    }
    if (reviewButton) {
      requestAnimationFrame(() => {
        const review = document.getElementById("reviewSummary");
        if (review) renderGate(review, result, "review");
      });
    }
  }, true);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
else install();

export { validateQuestions, criterionGrounding, inferCriterionDemand };
