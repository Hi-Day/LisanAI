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
  return [...document.querySelectorAll("#editableQuestionList .editable-question")].map((card, index) => {
    const prompt = normalizeText(card.querySelector("[data-field='prompt']")?.value);
    const chip = card.querySelector(".q-criteria-chip")?.textContent || "";
    const criteriaText = chip.replace(/^Rubrik yang diukur soal ini:\s*/i, "").trim();
    const criteria = criteriaText ? criteriaText.split(/\s+·\s+/).map(normalizeText).filter(Boolean) : [];
    return { index, prompt, criteria, card };
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
      const result = criterionGrounding(q.prompt, criterion);
      if (!result.grounded) {
        issues.push({
          index: q.index,
          type: "ungrounded",
          criterion,
          demand: result.demand?.label || "evidence spesifik",
          message: `Soal ${q.index + 1}: criterion “${criterion}” membutuhkan ${result.demand?.label || "evidence spesifik"}, tetapi pertanyaannya belum memintanya.`,
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
    .pedagogical-gate .gate-action { margin-top: 12px; font-size: .9rem; }
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
    gate.innerHTML = `<h4>⚠ Quality Gate: perlu diperbaiki</h4><p>${result.issues.length} masalah grounding ditemukan. Perbaiki pertanyaan terlebih dahulu agar criterion tidak menilai evidence yang tidak pernah diminta.</p><ul>${result.issues.map((issue) => `<li>${escapeHtml(issue.message)}</li>`).join("")}</ul><p class="gate-action"><strong>Prinsip:</strong> jangan menambah permintaan evidence hanya untuk memenuhi rubric; sesuaikan criterion dengan substansi soal.</p>`;
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

function install() {
  installStyles();
  document.addEventListener("click", (event) => {
    const reviewButton = event.target.closest("#wizardToReview");
    const publishButton = event.target.closest("#saveQuestionSet");
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
