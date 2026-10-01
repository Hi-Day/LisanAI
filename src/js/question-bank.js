import { listQuestionBank, saveQuestionToBank, deleteQuestionFromBank } from "./api.js";
import { showToast, showConfirmDialog } from "./toast.js";
import { showEmpty, setButtonLoading } from "./dom.js";
import { escapeHtml } from "./utils.js";
import { renderCurrentState, switchView } from "./app-context.js";
import { renderRubricTable } from "./render.js";

function normalizeOutcome(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9\u00C0-\u024F]+/gi, " ").replace(/\s+/g, " ").trim();
}

function parseAssessmentOutcomes(value) {
  if (Array.isArray(value)) return value.map((item, index) => {
    if (typeof item === "string") return { id: `LO${index + 1}`, text: item.trim() };
    return {
      id: String(item?.id || item?.learningOutcomeId || `LO${index + 1}`).trim(),
      text: String(item?.text || item?.name || item?.title || item?.outcome || "").trim(),
    };
  }).filter((item) => item.text);
  const text = String(value || "").trim();
  if (!text) return [];
  return text.split(/\r?\n|\s*;\s*/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const named = line.match(/^(?:[-*•]\s*)?(?:LO|CPL|CPMK|Learning Outcome)\s*[-#:.\s]*?(\d+)\s*[-:.):]?\s*(.+)$/i);
    if (named) return { id: `LO${named[1]}`, text: named[2].trim() };
    const numbered = line.match(/^(?:[-*•]\s*)?(\d+)[.)]\s*(.+)$/);
    if (numbered) return { id: `LO${numbered[1]}`, text: numbered[2].trim() };
    return { id: `LO${index + 1}`, text: line };
  });
}

/**
 * Rebind a question-bank question to the assessment's current LO objects.
 * Text is checked first so a bank question cannot silently keep a stale local
 * LO1/LO2 identifier after being imported into another assessment.
 */
export function rebindQuestionToAssessmentOutcomes(question, outcomesValue) {
  const outcomes = parseAssessmentOutcomes(outcomesValue);
  if (!outcomes.length) return { ...question, learningOutcomeIds: [], learningOutcomeId: "" };

  const questionText = normalizeOutcome(question?.outcome);
  let matched = questionText
    ? outcomes.filter((lo) => normalizeOutcome(lo.text) === questionText)
    : [];

  if (!matched.length && questionText) {
    // Support legacy/multi-LO bank entries whose outcome field contains
    // several current LO texts joined by "; ".
    matched = outcomes.filter((lo) => {
      const text = normalizeOutcome(lo.text);
      return text && questionText.includes(text);
    });
  }
  if (!matched.length && questionText) {
    matched = outcomes.filter((lo) => {
      const text = normalizeOutcome(lo.text);
      return text && (text.includes(questionText) || questionText.includes(text));
    }).slice(0, 1);
  }

  if (!matched.length) {
    const ids = Array.isArray(question?.learningOutcomeIds)
      ? question.learningOutcomeIds.map(String)
      : (question?.learningOutcomeId ? [String(question.learningOutcomeId)] : []);
    matched = ids.map((id) => outcomes.find((lo) => normalizeOutcome(lo.id) === normalizeOutcome(id))).filter(Boolean);
  }

  if (!matched.length) return { ...question, learningOutcomeIds: [], learningOutcomeId: "" };

  return {
    ...question,
    learningOutcomeIds: matched.map((lo) => lo.id),
    learningOutcomeId: matched[0].id,
    outcome: matched.map((lo) => lo.text).join("; "),
  };
}

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
      const mappedQuestion = rebindQuestionToAssessmentOutcomes(
        question,
        ctx.pendingAssessmentConfig?.outcomes
      );
      ctx.pendingQuestions.push({
        id: `q-${Date.now()}-${ctx.pendingQuestions.length}`,
        prompt: mappedQuestion.prompt,
        focus: mappedQuestion.focus,
        outcome: mappedQuestion.outcome,
        learningOutcomeIds: mappedQuestion.learningOutcomeIds || [],
        learningOutcomeId: mappedQuestion.learningOutcomeId || "",
        rubric: mappedQuestion.rubric,
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
              ${q.learningOutcomeId ? `<span class="tag" style="margin-left:4px;">${escapeHtml(q.learningOutcomeId)}</span>` : '<span style="color: var(--danger, #b42318);">· Belum terpetakan ke LO</span>'}
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
  window.__lisanAssessmentWizardBridge?.sync?.();
  const config = ctx.pendingAssessmentConfig;
  if (!config || !ctx.pendingQuestions.length) {
    showToast("Tidak ada soal untuk disimpan", "error");
    return;
  }
  ctx.pendingQuestions = ctx.pendingQuestions.map((question) => rebindQuestionToAssessmentOutcomes(question, config.outcomes));
  let saved = 0;
  for (const q of ctx.pendingQuestions) {
    try {
      await saveQuestionToBank({
        topic: config.topic || "",
        difficulty: config.difficulty || "",
        prompt: q.prompt,
        focus: q.focus,
        outcome: q.outcome,
        learningOutcomeIds: Array.isArray(q.learningOutcomeIds) ? q.learningOutcomeIds : (q.learningOutcomeId ? [q.learningOutcomeId] : []),
        learningOutcomeId: q.learningOutcomeId || "",
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