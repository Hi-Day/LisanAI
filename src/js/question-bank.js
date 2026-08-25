import { listQuestionBank, saveQuestionToBank, deleteQuestionFromBank } from "./api.js";
import { showToast, showConfirmDialog } from "./toast.js";
import { showEmpty, setButtonLoading } from "./dom.js";
import { escapeHtml } from "./utils.js";
import { renderCurrentState, switchView } from "./app-context.js";
import { renderRubricTable } from "./render.js";

export function bindQuestionBankEvents(ctx) {
  const { els } = ctx;

  els.questionBankFilter.addEventListener("input", () => {
    loadQuestionBank(ctx);
  });

  els.questionBankImportBtn.addEventListener("click", () => {
    switchView(ctx, "teacherView");
  });

  els.questionBankList.addEventListener("click", async (event) => {
    const deleteBtn = event.target.closest(".delete-question-btn");
    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      const proceed = await showConfirmDialog("Hapus soal dari bank soal?", "Hapus Soal");
      if (!proceed) return;
      try {
        await deleteQuestionFromBank(id);
        showToast("Soal dihapus dari bank", "success");
        await loadQuestionBank(ctx);
      } catch (err) {
        showToast(err.message, "error");
      }
      return;
    }

    const importBtn = event.target.closest(".import-question-btn");
    if (importBtn) {
      const id = importBtn.dataset.id;
      const question = ctx._questionBankData?.find((q) => q.id === id);
      if (!question) return;
      ctx.pendingQuestions.push({
        id: `q-${Date.now()}-${ctx.pendingQuestions.length}`,
        prompt: question.prompt,
        focus: question.focus,
        outcome: question.outcome,
        rubric: question.rubric,
        ideal: question.ideal,
        criteria: question.criteria || [],
      });
      const { renderQuestionEditor } = await import("./assessment-wizard.js");
      renderQuestionEditor(ctx);
      showToast("Soal ditambahkan ke wizard", "success");
    }
  });
}

export async function loadQuestionBank(ctx) {
  const { els } = ctx;
  const filter = els.questionBankFilter?.value?.trim() || "";
  try {
    const questions = await listQuestionBank(filter ? { topic: filter } : {});
    ctx._questionBankData = questions;
    els.questionBankCount.textContent = String(questions.length);

    if (!questions.length) {
      showEmpty(els.questionBankList, "list-stack empty-state", "Belum ada soal tersimpan. Simpan soal dari wizard penilaian.");
      return;
    }

    els.questionBankList.className = "list-stack";
    els.questionBankList.innerHTML = questions.map((q) => `
      <article class="feedback-card" style="position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div style="flex: 1;">
            <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 6px; flex-wrap: wrap;">
              <span class="tag badge-published">${escapeHtml(q.difficulty || "Umum")}</span>
              <span class="tag" style="background: var(--accent-light); color: var(--accent);">${escapeHtml(q.topic || "Tanpa topik")}</span>
            </div>
            <strong>${escapeHtml(q.prompt)}</strong>
            <p style="color: var(--muted); font-size: 0.9rem; margin-top: 6px;">
              Fokus: ${escapeHtml(q.focus)}${q.outcome ? ` · ${escapeHtml(q.outcome)}` : ""}
            </p>
            ${q.rubric ? `<div style="margin-top:8px;">${renderRubricTable(q.rubric)}</div>` : ""}
          </div>
          <div style="display: flex; gap: 6px; flex-shrink: 0;">
            <button type="button" class="secondary-button import-question-btn" data-id="${q.id}" title="Gunakan soal ini di wizard">Gunakan</button>
            <button type="button" class="action-button danger-button delete-question-btn" data-id="${q.id}" aria-label="Hapus soal">&times;</button>
          </div>
        </div>
        <small style="color: var(--muted); display: block; margin-top: 8px; font-size: 0.8rem;">
          ${new Date(q.createdAt).toLocaleDateString("id-ID")}
        </small>
      </article>
    `).join("");
  } catch (err) {
    showToast(err.message, "error");
  }
}

export async function saveCurrentQuestionsToBank(ctx) {
  const config = ctx.pendingAssessmentConfig;
  if (!config || !ctx.pendingQuestions.length) {
    showToast("Tidak ada soal untuk disimpan", "error");
    return;
  }
  let saved = 0;
  for (const q of ctx.pendingQuestions) {
    try {
      await saveQuestionToBank({
        topic: config.topic || "",
        difficulty: config.difficulty || "",
        prompt: q.prompt,
        focus: q.focus,
        outcome: q.outcome,
        rubric: q.rubric,
        ideal: q.ideal,
        criteria: q.criteria,
      });
      saved++;
    } catch (err) {
      showToast(`Gagal menyimpan soal: ${err.message}`, "error");
    }
  }
  showToast(`${saved} soal disimpan ke bank soal`, "success");
}