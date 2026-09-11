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
        issues.push({
          index: q.index,
          type: "ungrounded",
          criterion: name,
          demand: result.demand?.label || "evidence spesifik",
          message: `Soal ${q.index + 1}: criterion “${name}” membutuhkan ${result.demand?.label || "evidence spesifik"}, tetapi pertanyaannya belum memintanya.`,
        });
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
    .pedagogical-gate .repair-preview { margin-top: 14px; display: grid; gap: 10px; }
    .pedagogical-gate .repair-card { padding: 12px; border: 1px solid var(--line); border-radius: 11px; }
    .pedagogical-gate .repair-card.before { background: color-mix(in srgb, var(--panel) 94%, #b42318 6%); }
    .pedagogical-gate .repair-card.after { background: color-mix(in srgb, var(--panel) 94%, #027a48 6%); }
    .pedagogical-gate .repair-card strong { display: block; margin-bottom: 6px; }
    .pedagogical-gate .repair-card p { margin: 4px 0 0; font-size: .9rem; }
    .pedagogical-gate .repair-meta { margin-top: 8px; font-size: .82rem; color: var(--muted); }
    .pedagogical-gate .repair-apply-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    .pedagogical-gate .repair-apply-row button { flex: 1 1 180px; }
    @media (min-width: 640px) { .pedagogical-gate .gate-actions { grid-template-columns: 1.25fr 1fr 1fr; } .pedagogical-gate .repair-preview { grid-template-columns: 1fr 1fr; } }
    @media (prefers-reduced-motion: reduce) { .pedagogical-gate * { scroll-behavior: auto !important; } }
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
    return changed ? {
      questionIndex: index,
      before: { prompt: before.prompt || "", rubricSummary: questionSummary(before) },
      after: { prompt: after.prompt || "", rubricSummary: questionSummary(after) },
    } : null;
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
    gate.innerHTML = `<h4>⚠ Quality Gate: perlu diperbaiki</h4><p>${result.issues.length} masalah grounding ditemukan. AI dapat memperbaikinya tanpa memaksakan evidence baru.</p><ul>${result.issues.map((issue) => `<li>${escapeHtml(issue.message)}</li>`).join("")}</ul><div class="gate-actions"><button type="button" class="primary-button pedagogical-repair-btn" data-repair-mode="auto">✨ Perbaiki dengan AI</button><button type="button" class="secondary-button pedagogical-repair-btn" data-repair-mode="question">↻ Regenerate soal</button><button type="button" class="secondary-button pedagogical-repair-btn" data-repair-mode="rubric">⚖ Sesuaikan rubrik</button></div><p class="gate-repair-status" aria-live="polite"></p><div class="gate-repair-preview"></div><p class="gate-action"><strong>Prinsip:</strong> jika criterion memang penting, AI memperjelas permintaan evidence pada soal. Jika tidak, AI menyesuaikan rubric agar tidak menilai hal yang tidak ditanyakan.</p>`;
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

async function requestRepair(mode, result) {
  const bridge = window.__lisanAssessmentWizardBridge;
  if (!bridge?.ctx) throw new Error("Assessment wizard belum siap.");
  bridge.sync();
  const ctx = bridge.ctx;
  const beforeQuestions = (ctx.pendingQuestions || []).map((question) => ({ ...question, criteria: Array.isArray(question.criteria) ? question.criteria.map((c) => ({ ...c })) : [] }));
  const domQuestions = collectQuestions();
  const questions = beforeQuestions.map((question, index) => ({
    ...question,
    prompt: domQuestions[index]?.prompt || question.prompt,
    focus: domQuestions[index]?.focus || question.focus,
    outcome: domQuestions[index]?.outcome || question.outcome,
    ideal: domQuestions[index]?.ideal || question.ideal,
  }));
  const topic = document.getElementById("topic")?.value?.trim() || ctx.pendingAssessmentConfig?.topic || "";
  const outcomes = document.getElementById("outcomes")?.value?.trim() || ctx.pendingAssessmentConfig?.outcomes || "";
  const csrfToken = await getCsrfToken();
  const response = await fetch("/api/assessment", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: JSON.stringify({
      action: "repair-pedagogical-grounding",
      payload: { mode, topic, outcomes, issues: result.issues, questions },
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "AI gagal memperbaiki grounding.");
  if (!Array.isArray(data.questions) || data.questions.length !== questions.length) throw new Error("AI mengembalikan jumlah soal yang tidak sesuai.");
  return { data, beforeQuestions, afterQuestions: data.questions };
}

function renderRepairPreview(gate, repair) {
  const host = gate.querySelector(".gate-repair-preview");
  if (!host) return;
  const changes = buildChanges(repair.beforeQuestions, repair.afterQuestions);
  const method = repair.data.repairedBy === "ai" ? "AI" : "AI + pemeriksaan deterministik";
  host.innerHTML = `<div class="repair-meta">Rekomendasi dari ${method}. Perubahan belum diterapkan.</div>` +
    (changes.length
      ? `<div class="repair-preview">${changes.map((change) => `<article class="repair-card before"><strong>Sebelum — Soal ${change.questionIndex + 1}</strong><div>${escapeHtml(change.before.prompt)}</div><p>${escapeHtml(change.before.rubricSummary)}</p></article><article class="repair-card after"><strong>Sesudah — Soal ${change.questionIndex + 1}</strong><div>${escapeHtml(change.after.prompt)}</div><p>${escapeHtml(change.after.rubricSummary)}</p></article>`).join("")}</div>`
      : `<p class="repair-meta">AI tidak mengusulkan perubahan pada soal yang tersedia.</p>`);
  const row = document.createElement("div");
  row.className = "repair-apply-row";
  row.innerHTML = `<button type="button" class="primary-button apply-repair">✓ Terapkan perubahan</button><button type="button" class="secondary-button reject-repair">Tolak</button>`;
  host.appendChild(row);

  row.querySelector(".apply-repair").addEventListener("click", () => {
    const bridge = window.__lisanAssessmentWizardBridge;
    if (!bridge?.ctx) return;
    bridge.ctx.pendingQuestions = repair.afterQuestions.map((question, index) => ({
      ...repair.beforeQuestions[index],
      ...question,
      id: repair.beforeQuestions[index]?.id || question.id,
      probing: repair.beforeQuestions[index]?.probing ?? question.probing,
    }));
    bridge.render();
    const nextResult = validateQuestions();
    showGateAtQuestionEditor(nextResult);
    const status = document.querySelector(".pedagogical-gate .gate-repair-status");
    if (status) status.textContent = nextResult.valid ? "✓ Perubahan diterapkan dan Quality Gate lulus." : "⚠ Perubahan diterapkan, tetapi masih ada masalah yang perlu ditinjau.";
  });
  row.querySelector(".reject-repair").addEventListener("click", () => {
    host.innerHTML = "<p class=\"gate-repair-status\">Perubahan AI ditolak. Soal dan rubrik tetap seperti semula.</p>";
    gate.querySelectorAll(".pedagogical-repair-btn").forEach((button) => { button.disabled = false; });
  });
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
        const repair = await requestRepair(mode, result);
        renderRepairPreview(gate, repair);
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
