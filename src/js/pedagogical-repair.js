const DEMAND_LABELS = {
  application: "contoh/penerapan",
  comparison: "perbandingan",
  analysis: "analisis/sebab-akibat",
  evaluation: "evaluasi",
  reasoning: "alasan/argumentasi",
  procedure: "prosedur",
  identification: "identifikasi",
};

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getGroundingProblems(ctx) {
  const questions = ctx?.pendingQuestions || [];
  const problems = [];
  questions.forEach((question, index) => {
    const prompt = String(question?.prompt || "");
    const criteria = Array.isArray(question?.criteria) ? question.criteria : [];
    criteria.forEach((criterion) => {
      const name = typeof criterion === "string" ? criterion : criterion?.name || criterion?.id || "";
      const lower = String(name).toLowerCase();
      const demand = Object.entries(DEMAND_LABELS).find(([type, label]) => {
        const patterns = {
          application: /\b(?:contoh|penerapan|kasus|situasi)\b/i,
          comparison: /\b(?:banding|perbandingan|persamaan|perbedaan)\b/i,
          analysis: /\b(?:analisis|analisa|sebab|akibat|dampak|pengaruh|hubungan)\b/i,
          evaluation: /\b(?:evaluasi|menilai|kritik|kelebihan|kelemahan|batasan)\b/i,
          reasoning: /\b(?:alasan|argument|argumen|kedalaman)\b/i,
          procedure: /\b(?:langkah|prosedur|cara|tahapan|proses)\b/i,
          identification: /\b(?:identifikasi|ketepatan|pemilihan|menyebut|nama)\b/i,
        };
        return patterns[type].test(lower);
      });
      if (demand) {
        const patterns = {
          application: /\b(?:contoh|misal|misalnya|penerapan|diterapkan|kasus|situasi konkret|situasi)\b/i,
          comparison: /\b(?:bandingkan|perbandingan|persamaan|perbedaan|berbeda)\b/i,
          analysis: /\b(?:analisis|analisa|hubungan sebab|sebab-akibat|menghubungkan|hubungkan|dampak|pengaruh)\b/i,
          evaluation: /\b(?:evaluasi|nilai|menilai|kritisi|kritik|kelebihan|kelemahan|batasan)\b/i,
          reasoning: /\b(?:mengapa|kenapa|alasan|jelaskan\s+(?:mengapa|alasan|pilihan|hubungan|proses)|uraikan\s+alasan|argumentasi|argumen)\b/i,
          procedure: /\b(?:langkah|prosedur|cara|tahapan|proses)\b/i,
          identification: /\b(?:identifikasi|pilih|tentukan|sebutkan|nama(?:kan)?|menentukan|memilih)\b/i,
        };
        if (!patterns[demand[0]].test(prompt)) {
          problems.push({ questionIndex: index, criterion: name, demand: demand[0], label: DEMAND_LABELS[demand[0]] });
        }
      }
    });
  });
  return problems;
}

function ensureStyles() {
  if (document.getElementById("pedagogical-repair-style")) return;
  const style = document.createElement("style");
  style.id = "pedagogical-repair-style";
  style.textContent = `
    .pedagogical-repair { margin-top: 14px; padding: 16px; border: 1px solid var(--line); border-radius: 14px; background: var(--panel); }
    .pedagogical-repair h4 { margin: 0 0 8px; }
    .pedagogical-repair p { margin: 5px 0 12px; color: var(--muted); line-height: 1.5; }
    .pedagogical-repair-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .pedagogical-repair-actions button { min-height: 40px; }
    .pedagogical-repair-choice { display: grid; gap: 8px; margin: 12px 0; }
    .pedagogical-repair-choice label { display: flex; gap: 8px; align-items: flex-start; padding: 9px 10px; border: 1px solid var(--line); border-radius: 10px; cursor: pointer; }
    .pedagogical-repair-diff { margin-top: 14px; display: grid; gap: 10px; }
    .pedagogical-repair-diff article { padding: 12px; border-radius: 10px; border: 1px solid var(--line); }
    .pedagogical-repair-diff .before { background: color-mix(in srgb, var(--danger, #b42318) 7%, var(--panel)); }
    .pedagogical-repair-diff .after { background: color-mix(in srgb, var(--success, #027a48) 7%, var(--panel)); }
    .pedagogical-repair-diff strong { display: block; margin-bottom: 5px; }
    @media (min-width: 720px) { .pedagogical-repair-diff { grid-template-columns: 1fr 1fr; } }
  `;
  document.head.appendChild(style);
}

function sync(ctx) {
  if (typeof ctx?.syncQuestionsFromEditor === "function") ctx.syncQuestionsFromEditor(ctx);
}

async function callRepair(ctx, mode, problems) {
  const response = await fetch("/api/assessment?action=repair-grounding", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": (await getCsrfToken()) || "" },
    credentials: "same-origin",
    body: JSON.stringify({
      mode,
      assessment: ctx.pendingAssessmentConfig,
      questions: ctx.pendingQuestions,
      problems,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "AI repair gagal.");
  return data;
}

let csrfToken = null;
async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  try {
    const response = await fetch("/api/auth?action=me", { credentials: "same-origin" });
    const data = await response.json();
    csrfToken = data.csrfToken || null;
    return csrfToken;
  } catch { return null; }
}

function renderDiff(host, result) {
  const changes = result?.changes || [];
  if (!changes.length) {
    host.innerHTML = `<p><strong>AI tidak menemukan perubahan yang diperlukan.</strong> Quality Gate akan diperiksa ulang.</p>`;
    return;
  }
  host.innerHTML = `<div class="pedagogical-repair-diff">${changes.map((change) => `
    <article class="before"><strong>Sebelum — Soal ${Number(change.questionIndex) + 1}</strong><div>${escapeHtml(change.before?.prompt || "")}</div><p>${escapeHtml(change.before?.rubricSummary || "")}</p></article>
    <article class="after"><strong>Sesudah — Soal ${Number(change.questionIndex) + 1}</strong><div>${escapeHtml(change.after?.prompt || "")}</div><p>${escapeHtml(change.after?.rubricSummary || "")}</p></article>
  `).join("")}</div>`;
}

export function installPedagogicalRepair(ctx) {
  ensureStyles();
  const gate = document.querySelector(".pedagogical-gate");
  if (!gate || gate.dataset.repairInstalled === "1") return;
  const problems = getGroundingProblems(ctx);
  if (!problems.length) return;
  gate.dataset.repairInstalled = "1";

  const panel = document.createElement("div");
  panel.className = "pedagogical-repair";
  panel.innerHTML = `
    <h4>✨ Perbaiki masalah dengan AI</h4>
    <p>Pilih strategi. AI akan menyiapkan perubahan terlebih dahulu; tidak ada perubahan yang diterapkan sebelum Anda menyetujuinya.</p>
    <div class="pedagogical-repair-choice">
      <label><input type="radio" name="repair-mode" value="auto" checked> <span><strong>AI pilih solusi terbaik</strong><br><small>AI menentukan apakah soal atau rubrik yang perlu diperbaiki.</small></span></label>
      <label><input type="radio" name="repair-mode" value="question"> <span><strong>Regenerate soal</strong><br><small>Pertahankan criterion, perjelas evidence demand di pertanyaan.</small></span></label>
      <label><input type="radio" name="repair-mode" value="rubric"> <span><strong>Sesuaikan rubrik</strong><br><small>Pertahankan pertanyaan dan hapus/sesuaikan criterion yang tidak dituntut.</small></span></label>
    </div>
    <div class="pedagogical-repair-actions"><button type="button" class="primary-button repair-generate">✨ Buat rekomendasi AI</button></div>
    <div class="pedagogical-repair-result"></div>
  `;
  gate.appendChild(panel);

  panel.querySelector(".repair-generate").addEventListener("click", async () => {
    const mode = panel.querySelector("input[name='repair-mode']:checked")?.value || "auto";
    const button = panel.querySelector(".repair-generate");
    const resultHost = panel.querySelector(".pedagogical-repair-result");
    button.disabled = true;
    button.textContent = "AI sedang menganalisis...";
    resultHost.innerHTML = "<p>Menyiapkan perubahan tanpa mengubah soal saat ini...</p>";
    try {
      sync(ctx);
      const result = await callRepair(ctx, mode, problems);
      renderDiff(resultHost, result);
      const actions = document.createElement("div");
      actions.className = "pedagogical-repair-actions";
      actions.innerHTML = `<button type="button" class="primary-button apply-repair">✓ Terapkan perubahan</button><button type="button" class="secondary-button reject-repair">Tolak</button>`;
      resultHost.appendChild(actions);
      actions.querySelector(".apply-repair").addEventListener("click", () => {
        ctx.pendingQuestions = result.questions || ctx.pendingQuestions;
        if (result.assessment) ctx.pendingAssessmentConfig = { ...ctx.pendingAssessmentConfig, ...result.assessment };
        panel.remove();
        ctx.renderQuestionEditor(ctx);
        if (typeof ctx.renderReviewSummary === "function") ctx.renderReviewSummary(ctx);
      });
      actions.querySelector(".reject-repair").addEventListener("click", () => {
        resultHost.innerHTML = "<p>Perubahan AI ditolak. Soal dan rubrik tetap seperti semula.</p>";
        button.disabled = false;
        button.textContent = "✨ Buat rekomendasi AI";
      });
    } catch (error) {
      resultHost.innerHTML = `<p>⚠ ${escapeHtml(error.message)}</p>`;
      button.disabled = false;
      button.textContent = "✨ Coba lagi";
    }
  });
}
