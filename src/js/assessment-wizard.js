import { DEFAULT_QUESTION_COUNT } from "./config.js";
import {
  saveAssessmentToDatabase,
  streamAssessmentAction,
  updateAssessment,
} from "./api.js";
import { createAssessment, readAssessmentForm } from "./assessment-factory.js";
import { setButtonLoading } from "./dom.js";
import { generateFallbackQuestions, recommendFallbackConfig } from "./fallback-assessment.js";
import { showToast } from "./toast.js";
import { compactText, escapeHtml, formatTime } from "./utils.js";
import { renderCurrentState } from "./app-context.js";

/**
 * Assessment creation wizard: context form, AI question generation,
 * manual editing, review summary, and publish.
 */
export function bindAssessmentWizardEvents(ctx) {
  const { els } = ctx;

  els.form.addEventListener("submit", (event) => handleAssessmentSubmit(ctx, event));
  if (els.createManualAssessment) {
    els.createManualAssessment.addEventListener("click", (event) => handleCreateManualAssessment(ctx, event));
  }
  els.saveQuestionSet.addEventListener("click", () => savePendingQuestionSet(ctx));
  els.improveQuestionSet.addEventListener("click", () => improvePendingQuestionSet(ctx));
  if (els.addManualQuestion) {
    els.addManualQuestion.addEventListener("click", () => handleAddManualQuestion(ctx));
  }

  // Delete a single question from the editor (event delegation).
  els.editableQuestionList.addEventListener("click", (event) => {
    const deleteBtn = event.target.closest(".delete-question");
    if (!deleteBtn) return;
    handleDeleteQuestion(ctx, Number(deleteBtn.dataset.index));
  });

  // Wizard navigation
  if (els.wizardToQuestions) {
    els.wizardToQuestions.addEventListener("click", () => {
      const config = readAssessmentForm(els);
      if (!config.topic) {
        showToast("Isi topik atau materi terlebih dahulu.");
        els.topic.focus();
        return;
      }
      if (!config.outcomes) {
        showToast("Isi kompetensi / capaian pembelajaran terlebih dahulu.");
        els.outcomes.focus();
        return;
      }
      if (!config.rubric) {
        showToast("Isi rubrik penilaian terlebih dahulu.");
        els.rubric.focus();
        return;
      }
      if (!config.classId) {
        showToast("Pilih kelas tujuan terlebih dahulu.");
        els.classSelect.focus();
        return;
      }
      ctx.pendingAssessmentConfig = config;
      goToWizardStep(ctx, 2);
    });
  }
  if (els.wizardBackToContext) {
    els.wizardBackToContext.addEventListener("click", () => goToWizardStep(ctx, 1));
  }
  if (els.wizardToReview) {
    els.wizardToReview.addEventListener("click", () => {
      if (!ctx.pendingAssessmentConfig) {
        showToast("Buat atau buka penilaian dulu sebelum meninjau.");
        return;
      }
      syncQuestionsFromEditor(ctx);
      goToWizardStep(ctx, 3);
    });
  }
  if (els.wizardBackToQuestions) {
    els.wizardBackToQuestions.addEventListener("click", () => goToWizardStep(ctx, 2));
  }
  els.wizardSteps.forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = Number(btn.dataset.wizardStep);
      if (step <= ctx.currentWizardStep) goToWizardStep(ctx, step);
    });
  });

  if (els.editDisableManualTyping) {
    els.editDisableManualTyping.addEventListener("change", (e) => {
      if (ctx.pendingAssessmentConfig) {
        ctx.pendingAssessmentConfig.disableManualTyping = e.target.checked;
      }
    });
  }
  if (els.editOralExamEnabled) {
    els.editOralExamEnabled.addEventListener("change", (e) => {
      if (ctx.pendingAssessmentConfig) {
        ctx.pendingAssessmentConfig.oralExamEnabled = e.target.checked;
      }
    });
  }
  if (els.editAllowRetakes) {
    els.editAllowRetakes.addEventListener("change", (e) => {
      if (ctx.pendingAssessmentConfig) {
        ctx.pendingAssessmentConfig.allowRetakes = e.target.checked;
      }
    });
  }

  els.recommendOutcomes.addEventListener("click", () => fillRecommendedFields(ctx, "outcomes"));
  els.recommendRubric.addEventListener("click", () => fillRecommendedFields(ctx, "rubric"));
}

export async function handleAssessmentSubmit(ctx, event) {
  event.preventDefault();
  const { els } = ctx;
  const config = readAssessmentForm(els);
  if (!config.classId) {
    showToast("Pilih kelas tujuan terlebih dahulu.");
    return;
  }

  setButtonLoading(event.submitter, true, "Menghubungi AI...", "Buat soal dengan AI");
  showStreamPanel(ctx, els.aiStreamPanel, els.aiStreamTitle, els.aiStreamContent, "AI sedang membuat soal...");
  try {
    const questions = await generateQuestionsWithFallback(ctx, config);
    ctx.pendingAssessmentConfig = config;
    ctx.pendingQuestions = questions;
    hideStreamPanel(ctx, els.aiStreamPanel);
    renderQuestionEditor(ctx);
    goToWizardStep(ctx, 2);
  } finally {
    setButtonLoading(event.submitter, false, "Menghubungi AI...", "Buat soal dengan AI");
  }
}

export function handleCreateManualAssessment(ctx, event) {
  const { els } = ctx;
  const config = readAssessmentForm(els);
  if (!config.classId) {
    showToast("Pilih kelas tujuan terlebih dahulu.");
    return;
  }
  ctx.pendingAssessmentConfig = config;
  const count = Math.max(1, Number(config.count) || 1);
  ctx.pendingQuestions = Array.from({ length: count }).map((_, i) => ({
    id: `q-${i}`,
    prompt: "",
    focus: "",
    outcome: "",
    rubric: "",
    ideal: "",
  }));
  renderQuestionEditor(ctx);
  goToWizardStep(ctx, 2);
}

export function handleAddManualQuestion(ctx) {
  if (!ctx.pendingAssessmentConfig) {
    showToast("Buat atau buka penilaian dulu sebelum menambah soal.");
    return;
  }
  const idx = ctx.pendingQuestions.length;
  ctx.pendingQuestions.push({ id: `q-${idx}`, prompt: "", focus: "", outcome: "", rubric: "", ideal: "" });
  renderQuestionEditor(ctx);
}

export function handleDeleteQuestion(ctx, index) {
  if (!ctx.pendingAssessmentConfig) {
    showToast("Buat atau buka penilaian dulu sebelum menghapus soal.");
    return;
  }
  if (ctx.pendingQuestions.length <= 1) {
    showToast("Minimal harus ada satu soal.");
    return;
  }
  if (index < 0 || index >= ctx.pendingQuestions.length) return;

  // Sync current editor values first so unsaved edits are not lost.
  syncQuestionsFromEditor(ctx);
  ctx.pendingQuestions.splice(index, 1);
  renderQuestionEditor(ctx);
  showToast("Soal dihapus.");
}

export async function savePendingQuestionSet(ctx) {
  const { els } = ctx;
  if (!ctx.pendingAssessmentConfig) return;
  syncQuestionsFromEditor(ctx);
  const assessment = createAssessment(ctx.pendingAssessmentConfig, ctx.pendingQuestions);

  const existingIndex = ctx.state.assessments.findIndex((a) => a.id === assessment.id);
  if (existingIndex >= 0) {
    await updateAssessment(assessment.id, assessment);
    ctx.state.assessments[existingIndex] = assessment;
  } else {
    await saveAssessmentToDatabase(assessment);
    ctx.state.assessments.unshift(assessment);
  }

  ctx.session.selectAssessment(assessment.id);
  ctx.pendingAssessmentConfig = null;
  ctx.pendingQuestions = [];
  els.form.reset();
  els.questionCount.value = DEFAULT_QUESTION_COUNT;
  goToWizardStep(ctx, 1);
  await renderCurrentState(ctx);
}

export async function improvePendingQuestionSet(ctx) {
  const { els } = ctx;
  if (!ctx.pendingAssessmentConfig) return;
  syncQuestionsFromEditor(ctx);
  setButtonLoading(els.improveQuestionSet, true, "Memperbaiki...", "Perbaiki dengan AI");
  showStreamPanel(ctx, els.aiStreamPanel, els.aiStreamTitle, els.aiStreamContent, "AI sedang memperbaiki soal...");
  try {
    ctx.pendingQuestions = await improveQuestionsWithFallback(ctx, ctx.pendingAssessmentConfig, ctx.pendingQuestions);
    hideStreamPanel(ctx, els.aiStreamPanel);
    renderQuestionEditor(ctx);
  } catch (error) {
    showToast(error.message);
  } finally {
    setButtonLoading(els.improveQuestionSet, false, "Memperbaiki...", "Perbaiki dengan AI");
  }
}

export function syncQuestionsFromEditor(ctx) {
  const { els } = ctx;
  ctx.pendingQuestions = [...els.editableQuestionList.querySelectorAll(".editable-question")].map((item, index) => ({
    id: ctx.pendingQuestions[index]?.id || `q-${index}`,
    prompt: item.querySelector("[data-field='prompt']").value.trim(),
    focus: item.querySelector("[data-field='focus']").value.trim(),
    outcome: item.querySelector("[data-field='outcome']").value.trim(),
    rubric: item.querySelector("[data-field='rubric']").value.trim(),
    ideal: item.querySelector("[data-field='ideal']").value.trim(),
  }));
}

export function renderQuestionEditor(ctx) {
  const { els } = ctx;
  if (!ctx.pendingAssessmentConfig) {
    els.questionEditor.classList.add("hidden");
    els.editableQuestionList.innerHTML = "";
    return;
  }
  els.questionEditor.classList.remove("hidden");
  if (els.editDisableManualTyping) {
    els.editDisableManualTyping.checked = !!ctx.pendingAssessmentConfig.disableManualTyping;
  }
  if (els.editOralExamEnabled) {
    els.editOralExamEnabled.checked = ctx.pendingAssessmentConfig.oralExamEnabled !== false;
  }
  if (els.editAllowRetakes) {
    els.editAllowRetakes.checked = !!ctx.pendingAssessmentConfig.allowRetakes;
  }
  els.editableQuestionList.innerHTML = ctx.pendingQuestions.map((question, index) => `
    <article class="feedback-card editable-question">
      <div class="question-card-header">
        <strong>Soal ${index + 1}</strong>
        <button type="button" class="action-button danger-button delete-question" data-index="${index}" aria-label="Hapus soal ${index + 1}">Hapus</button>
      </div>
      <label>Pertanyaan<textarea data-field="prompt" rows="3">${escapeHtml(question.prompt)}</textarea></label>
      <label>Fokus<input data-field="focus" value="${escapeHtml(question.focus || "")}" /></label>
      <label>Learning outcome (kompetensi yang diukur)<textarea data-field="outcome" rows="2">${escapeHtml(question.outcome || "")}</textarea></label>
      <label>Rubrik penilaian soal ini<textarea data-field="rubric" rows="3">${escapeHtml(question.rubric || "")}</textarea></label>
      <label>Jawaban ideal<textarea data-field="ideal" rows="3">${escapeHtml(question.ideal || "")}</textarea></label>
    </article>
  `).join("");
  renderReviewSummary(ctx);
}

export function renderReviewSummary(ctx) {
  const { els } = ctx;
  if (!els.reviewSummary || !ctx.pendingAssessmentConfig) return;
  const config = ctx.pendingAssessmentConfig;
  const classId = config.classId;
  const className = ctx.state.classes.find((c) => c.id === classId)?.name || "Kelas tidak dipilih";
  const answered = ctx.pendingQuestions.filter((q) => (q.prompt || "").trim().length > 0).length;
  const total = ctx.pendingQuestions.length;
  const timeLimit = Number(config.timeLimit) || 0;

  els.reviewSummary.innerHTML = `
    <div class="review-block">
      <h4>Konteks</h4>
      <dl class="review-list">
        <div><dt>Topik</dt><dd>${escapeHtml(config.topic || "-")}</dd></div>
        <div><dt>Kelas</dt><dd>${escapeHtml(className)}</dd></div>
        <div><dt>Tingkat kesulitan</dt><dd>${escapeHtml(config.difficulty || "-")}</dd></div>
        <div><dt>Batas waktu per soal</dt><dd>${timeLimit > 0 ? formatTime(timeLimit) : "Tanpa batas"}</dd></div>
        <div><dt>Mode</dt><dd>${config.oralExamEnabled !== false ? "Ujian lisan" : "Tulisan"}${config.disableManualTyping ? " (typing dimatikan)" : ""}</dd></div>
        <div><dt>Retake</dt><dd>${config.allowRetakes ? "Diizinkan" : "Tidak diizinkan"}</dd></div>
      </dl>
    </div>
    <div class="review-block">
      <h4>Soal</h4>
      <p class="review-count">${answered} dari ${total} soal sudah diisi.</p>
      <ol class="review-questions">
        ${ctx.pendingQuestions.map((q, i) => `
          <li class="${(q.prompt || "").trim() ? "" : "review-empty"}">
            <strong>Soal ${i + 1}</strong>
            <span>${escapeHtml(compactText(q.prompt || "Belum diisi", 120))}</span>
          </li>
        `).join("")}
      </ol>
    </div>
  `;
}

export function goToWizardStep(ctx, step) {
  const { els } = ctx;
  ctx.currentWizardStep = step;
  els.wizardPanels.forEach((panel) => {
    panel.classList.toggle("hidden", Number(panel.dataset.wizardPanel) !== step);
  });
  els.wizardSteps.forEach((btn) => {
    const btnStep = Number(btn.dataset.wizardStep);
    const active = btnStep === step;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
    btn.disabled = btnStep > step;
  });
  if (step === 3) renderReviewSummary(ctx);
}

export async function handleRecommendConfig(ctx) {
  await fillRecommendedFields(ctx, "both");
}

export async function fillRecommendedFields(ctx, target) {
  const { els } = ctx;
  const topic = els.topic.value.trim();
  if (!topic) {
    showToast("Isi topik atau materi terlebih dahulu.");
    els.topic.focus();
    return;
  }

  const button = target === "rubric" ? els.recommendRubric : els.recommendOutcomes;
  const defaultText = target === "rubric" ? "Rekomendasikan rubrik" : "Rekomendasikan kompetensi";
  setButtonLoading(button, true, "Membuat rekomendasi...", defaultText);
  showStreamPanel(ctx, els.recommendStreamPanel, els.recommendStreamTitle, els.recommendStreamContent, "AI sedang membuat rekomendasi...");
  try {
    const recommendation = await recommendConfigWithFallback(ctx, topic, els.difficulty.value);
    if (target === "outcomes" || target === "both") els.outcomes.value = recommendation.outcomes;
    if (target === "rubric" || target === "both") els.rubric.value = recommendation.rubric;
    hideStreamPanel(ctx, els.recommendStreamPanel);
  } finally {
    setButtonLoading(button, false, "Membuat rekomendasi...", defaultText);
  }
}

export async function recommendConfigWithFallback(ctx, topic, difficulty) {
  try {
    return await streamAssessmentAction({
      action: "recommend-assessment-config",
      payload: { topic, difficulty },
      onChunk: (text) => appendStreamText(ctx.els.recommendStreamContent, text),
    });
  } catch (error) {
    showToast(`AI belum tersedia, memakai rekomendasi lokal. Detail: ${error.message}`);
    return recommendFallbackConfig(topic, difficulty);
  }
}

export async function generateQuestionsWithFallback(ctx, config) {
  try {
    return await streamAssessmentAction({
      action: "generate-questions",
      payload: config,
      onChunk: (text) => appendStreamText(ctx.els.aiStreamContent, text),
    });
  } catch (error) {
    showToast(`AI belum tersedia, memakai generator lokal. Detail: ${error.message}`);
    return generateFallbackQuestions(config);
  }
}

export async function improveQuestionsWithFallback(ctx, config, questions) {
  try {
    return await streamAssessmentAction({
      action: "improve-questions",
      payload: { config, questions },
      onChunk: (text) => appendStreamText(ctx.els.aiStreamContent, text),
    });
  } catch (error) {
    showToast(`AI belum tersedia, memakai question set sebelumnya. Detail: ${error.message}`);
    return questions;
  }
}

// ---------------------------------------------------------------------------
// Streaming panel helpers
// ---------------------------------------------------------------------------

function showStreamPanel(ctx, panel, titleEl, contentEl, title) {
  if (!panel) return;
  if (titleEl) titleEl.textContent = title;
  if (contentEl) contentEl.textContent = "";
  panel.classList.remove("hidden");
}

function hideStreamPanel(ctx, panel) {
  if (panel) panel.classList.add("hidden");
}

function appendStreamText(contentEl, text) {
  if (!contentEl) return;
  contentEl.textContent += text;
  contentEl.scrollTop = contentEl.scrollHeight;
}