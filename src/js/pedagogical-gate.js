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
    .pedagogical-gate {
      margin: 16px 0;
      padding: 16px 18px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: var(--panel);
    }
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
    @media (min-width: 640px) {
      .pedagogical-gate .gate-actions { grid-template-columns: 1.25fr 1fr 1fr; }
    }
    @media (prefers-reduced-motion: reduce) {
      .pedagogical-gate * { scroll-behavior: auto !important; }
    }
  `;
  document.head.appendChild(style);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
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
    gate.innerHTML = `<h4>⚠ Quality Gate: perlu diperbaiki</h4><p>${result.issues.length} masalah grounding ditemukan. AI dapat memperbaikinya tanpa memaksakan evidence baru.</p><ul>${result.issues.map((issue) => `<li>${escapeHtml(issue.message)}</li>`).join("")}</ul><div class="gate-actions"><button type="button" class="primary-button pedagogical-repair-btn" data-repair-mode="auto">✨ Perbaiki dengan AI</button><button type="button" class="secondary-button pedagogical-repair-btn" data-repair-mode="question">↻ Regenerate soal</button><button type="button" class="secondary-button pedagogical-repair-btn" data-repair-mode="rubric">⚖ Sesuaikan rubrik</button></div><p class="gate-repair-status" aria-live="polite"></p><p class="gate-action"><strong>Prinsip:</strong> jika criterion memang penting, AI memperjelas permintaan evidence pada soal. Jika tidak, AI menyesuaikan rubric agar tidak menilai hal yang tidak ditanyakan.</p>`;
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

async function repairWithAI(button, mode, result) {
  const bridge = window.__lisanAssessmentWizardBridge;
  if (!bridge?.ctx) throw new Error("Assessment wizard belum siap.");
  bridge.sync();
  const ctx = bridge.ctx;
  const questions = ctx.pendingQuestions || [];
  const payloadQuestions = questions.map((question, index) => ({
    ...question,
    prompt: collectQuestions()[index]?.prompt || question.prompt,
    focus: collectQuestions()[index]?.focus || question.focus,
    outcome: collectQuestions()[index]?.outcome || question.outcome,
    ideal: collectQuestions()[index]?.ideal || question.ideal,
  }));
  const topic = document.getElementById("topic")?.value?.trim() || ctx.pendingAssessmentConfig?.topic || "";
  const outcomes = document.getElementById("outcomes")?.value?.trim() || ctx.pendingAssessmentConfig?.outcomes || "";
  const status = button.closest(".pedagogical-gate")?.querySelector(".gate-repair-status");
  const csrfToken = await getCsrfToken();
  const response = await fetch("/api/assessment", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: JSON.stringify({
      action: "repair-pedagogical-grounding",
      payload: { mode, topic, outcomes, issues: result.issues, questions: payloadQuestions },
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "AI gagal memperbaiki grounding.");
  if (!Array.isArray(data.questions) || data.questions.length !== questions.length) {
    throw new Error("AI mengembalikan jumlah soal yang tidak sesuai.");
  }
  ctx.pendingQuestions = data.questions.map((question, index) => ({
    ...questions[index],
    ...question,
    id: questions[index].id,
    probing: questions[index].probing,
  }));
  bridge.render();
  const nextResult = validateQuestions();
  if (status) status.textContent = data.repairedBy === "ai" ? "✓ Perbaikan AI selesai." : "✓ Perbaikan selesai dengan pemeriksaan deterministik.";
  showGateAtQuestionEditor(nextResult);
  if (nextResult.valid) {
    const editor = document.getElementById("questionEditor");
    if (editor) renderGate(editor, nextResult, "review");
  }
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
      const buttons = gate?.querySelectorAll("button") || [];
      buttons.forEach((button) => { button.disabled = true; });
      repairButton.textContent = mode === "question" ? "↻ AI memperbaiki soal..." : mode === "rubric" ? "⚖ AI menyesuaikan rubrik..." : "✨ AI sedang memperbaiki...";
      try {
        await repairWithAI(repairButton, mode, result);
      } catch (error) {
        const status = gate?.querySelector(".gate-repair-status");
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
