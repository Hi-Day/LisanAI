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
import { compactText, escapeHtml, formatTime, prettifyId } from "./utils.js";
import { renderCurrentState } from "./app-context.js";
import { saveCurrentQuestionsToBank } from "./question-bank.js";
import { renderRubricTable } from "./render.js";
import {
  renderReviewSummary,
  goToWizardStep,
  handleRecommendConfig,
  fillRecommendedFields,
  recommendConfigWithFallback,
  generateQuestionsWithFallback,
  improveQuestionsWithFallback,
  alignRubricWithFallback,
  hideStreamPanel,
  showQuestionStreamPlaceholder,
  finishQuestionStream,
  renderRubrikBuilder,
  convertLegacyRubricToJson,
} from "./assessment-wizard-tail.js";

let _wizardCtx = null;

export function bindAssessmentWizardEvents(ctx) {
  _wizardCtx = ctx;
  window.__lisanAssessmentWizardBridge = {
    get ctx() { return _wizardCtx; },
    sync() { if (_wizardCtx) syncQuestionsFromEditor(_wizardCtx); },
    render() { if (_wizardCtx) renderQuestionEditor(_wizardCtx); },
  };
  const { els } = ctx;
  els.form.addEventListener("submit", (event) => handleAssessmentSubmit(ctx, event));
  if (els.createManualAssessment) els.createManualAssessment.addEventListener("click", (event) => handleCreateManualAssessment(ctx, event));
  els.saveQuestionSet.addEventListener("click", () => savePendingQuestionSet(ctx));
  if (els.addManualQuestion) els.addManualQuestion.addEventListener("click", () => handleAddManualQuestion(ctx));
  if (els.saveToBankBtn) els.saveToBankBtn.addEventListener("click", () => saveCurrentQuestionsToBank(ctx));
  els.editableQuestionList.addEventListener("click", (event) => { const deleteBtn = event.target.closest(".delete-question"); if (deleteBtn) handleDeleteQuestion(ctx, Number(deleteBtn.dataset.index)); });
  els.editableQuestionList.addEventListener("click", (event) => {
    const toggle = event.target.closest(".rubrik-builder-toggle"); if (!toggle) return;
    const index = toggle.dataset.index; const builder = document.querySelector(`.rubrik-builder-${index}`); if (!builder) return;
    const isHidden = builder.style.display === "none" || !builder.style.display; builder.style.display = isHidden ? "grid" : "none";
    if (isHidden) { builder.dataset.qIndex = index; renderRubrikBuilder(builder, ctx.pendingQuestions[index]?.rubric || ""); }
    else { const preview = toggle.closest("label")?.querySelector(".rubrik-preview"); if (preview && ctx.pendingQuestions[index]?.rubric) preview.innerHTML = renderRubricTable(ctx.pendingQuestions[index].rubric); }
  });
  if (els.wizardToQuestions) els.wizardToQuestions.addEventListener("click", () => { const config = readAssessmentForm(els); if (!config.topic) { showToast("Isi topik atau materi terlebih dahulu."); els.topic.focus(); return; } if (!config.outcomes) { showToast("Isi kompetensi / capaian pembelajaran terlebih dahulu."); els.outcomes.focus(); return; } if (!config.classId) { showToast("Pilih kelas tujuan terlebih dahulu."); els.classSelect.focus(); return; } ctx.pendingAssessmentConfig = config; goToWizardStep(ctx, 2); });
  if (els.wizardBackToContext) els.wizardBackToContext.addEventListener("click", () => goToWizardStep(ctx, 1));
  if (els.wizardToReview) els.wizardToReview.addEventListener("click", () => { if (!ctx.pendingAssessmentConfig) { showToast("Buat atau buka penilaian dulu sebelum meninjau."); return; } syncQuestionsFromEditor(ctx); goToWizardStep(ctx, 3); });
  if (els.wizardBackToQuestions) els.wizardBackToQuestions.addEventListener("click", () => goToWizardStep(ctx, 2));
  els.wizardSteps.forEach((btn) => btn.addEventListener("click", () => { const step = Number(btn.dataset.wizardStep); if (step <= ctx.currentWizardStep) goToWizardStep(ctx, step); }));
  if (els.editDisableManualTyping) els.editDisableManualTyping.addEventListener("change", (e) => { if (ctx.pendingAssessmentConfig) ctx.pendingAssessmentConfig.disableManualTyping = e.target.checked; });
  if (els.editOralExamEnabled) els.editOralExamEnabled.addEventListener("change", (e) => { if (ctx.pendingAssessmentConfig) ctx.pendingAssessmentConfig.oralExamEnabled = e.target.checked; });
  if (els.editAllowRetakes) els.editAllowRetakes.addEventListener("change", (e) => { if (ctx.pendingAssessmentConfig) ctx.pendingAssessmentConfig.allowRetakes = e.target.checked; });
  els.recommendOutcomes.addEventListener("click", () => fillRecommendedFields(ctx, "outcomes"));
}

export async function handleAssessmentSubmit(ctx, event) {
  event.preventDefault(); const { els } = ctx; const config = readAssessmentForm(els); if (!config.classId) { showToast("Pilih kelas tujuan terlebih dahulu."); return; }
  setButtonLoading(event.submitter, true, "Menghubungi AI...", "Buat soal dengan AI"); showQuestionStreamPlaceholder(ctx);
  try { const questions = await generateQuestionsWithFallback(ctx, config); ctx.pendingAssessmentConfig = config; ctx.pendingQuestions = questions.map((q) => ({ ...q, rubric: q.rubric ? convertLegacyRubricToJson(q.rubric) : "" })); finishQuestionStream(ctx); await new Promise((resolve) => setTimeout(resolve, 600)); hideStreamPanel(ctx, els.aiStreamPanel); renderQuestionEditor(ctx); goToWizardStep(ctx, 2); }
  finally { setButtonLoading(event.submitter, false, "Menghubungi AI...", "Buat soal dengan AI"); }
}
export function handleCreateManualAssessment(ctx) { const { els } = ctx; const config = readAssessmentForm(els); if (!config.classId) { showToast("Pilih kelas tujuan terlebih dahulu."); return; } ctx.pendingAssessmentConfig = config; const count = Math.max(1, Number(config.count) || 1); ctx.pendingQuestions = Array.from({ length: count }).map((_, i) => ({ id: `q-${i}`, prompt: "", focus: "", outcome: "", rubric: "", ideal: "" })); renderQuestionEditor(ctx); goToWizardStep(ctx, 2); }
export function handleAddManualQuestion(ctx) { if (!ctx.pendingAssessmentConfig) { showToast("Buat atau buka penilaian dulu sebelum menambah soal."); return; } const idx = ctx.pendingQuestions.length; ctx.pendingQuestions.push({ id: `q-${idx}`, prompt: "", focus: "", outcome: "", rubric: "", ideal: "" }); renderQuestionEditor(ctx); }
export function handleDeleteQuestion(ctx, index) { if (!ctx.pendingAssessmentConfig) { showToast("Buat atau buka penilaian dulu sebelum menghapus soal."); return; } if (ctx.pendingQuestions.length <= 1) { showToast("Minimal harus ada satu soal."); return; } if (index < 0 || index >= ctx.pendingQuestions.length) return; syncQuestionsFromEditor(ctx); ctx.pendingQuestions.splice(index, 1); renderQuestionEditor(ctx); showToast("Soal dihapus."); }
export async function savePendingQuestionSet(ctx) { const { els } = ctx; if (!ctx.pendingAssessmentConfig) return; syncQuestionsFromEditor(ctx); if (els.editIsTryout) ctx.pendingAssessmentConfig.isTryout = els.editIsTryout.checked; const assessment = createAssessment(ctx.pendingAssessmentConfig, ctx.pendingQuestions); const existingIndex = ctx.state.assessments.findIndex((a) => a.id === assessment.id); if (existingIndex >= 0) { await updateAssessment(assessment.id, assessment); ctx.state.assessments[existingIndex] = assessment; } else { await saveAssessmentToDatabase(assessment); ctx.state.assessments.unshift(assessment); } ctx.session.selectAssessment(assessment.id); ctx.pendingAssessmentConfig = null; ctx.pendingQuestions = []; els.form.reset(); els.questionCount.value = DEFAULT_QUESTION_COUNT; goToWizardStep(ctx, 1); await renderCurrentState(ctx); }
export async function improvePendingQuestionSet(ctx) { const { els } = ctx; if (!ctx.pendingAssessmentConfig) return; syncQuestionsFromEditor(ctx); const defaultText = "AI Rubric Alignment"; setButtonLoading(els.improveQuestionSet, true, "Menyelaraskan rubrik & soal...", defaultText); showQuestionStreamPlaceholder(ctx); try { ctx.pendingQuestions = await alignRubricWithFallback(ctx, ctx.pendingAssessmentConfig, ctx.pendingQuestions); finishQuestionStream(ctx); await new Promise((resolve) => setTimeout(resolve, 500)); hideStreamPanel(ctx, els.aiStreamPanel); renderQuestionEditor(ctx); } catch (error) { showToast(error.message); } finally { setButtonLoading(els.improveQuestionSet, false, "Menyelaraskan rubrik & soal...", defaultText); } }
export function syncQuestionsFromEditor(ctx) { const { els } = ctx; ctx.pendingQuestions = [...els.editableQuestionList.querySelectorAll(".editable-question")].map((item, index) => ({ id: ctx.pendingQuestions[index]?.id || `q-${index}`, prompt: item.querySelector("[data-field='prompt']").value.trim(), focus: item.querySelector("[data-field='focus']").value.trim(), outcome: item.querySelector("[data-field='outcome']").value.trim(), rubric: ctx.pendingQuestions[index]?.rubric || "", ideal: item.querySelector("[data-field='ideal']").value.trim(), criteria: ctx.pendingQuestions[index]?.criteria || [], probing: item.querySelector("[data-field='probing']")?.checked ?? !!ctx.pendingQuestions[index]?.probing })); }
export function renderQuestionEditor(ctx) { const { els } = ctx; if (!ctx.pendingAssessmentConfig) { els.questionEditor.classList.add("hidden"); els.editableQuestionList.innerHTML = ""; return; } els.questionEditor.classList.remove("hidden"); if (els.editDisableManualTyping) els.editDisableManualTyping.checked = !!ctx.pendingAssessmentConfig.disableManualTyping; if (els.editOralExamEnabled) els.editOralExamEnabled.checked = ctx.pendingAssessmentConfig.oralExamEnabled !== false; if (els.editAllowRetakes) els.editAllowRetakes.checked = !!ctx.pendingAssessmentConfig.allowRetakes; if (els.editIsTryout) els.editIsTryout.checked = !!ctx.pendingAssessmentConfig.isTryout; els.editableQuestionList.innerHTML = ctx.pendingQuestions.map((question, index) => `<article class="feedback-card editable-question"><div class="question-card-header"><strong>Soal ${index + 1}</strong><button type="button" class="action-button danger-button delete-question" data-index="${index}" aria-label="Hapus soal ${index + 1}">Hapus</button></div><label>Pertanyaan<textarea data-field="prompt" rows="3">${escapeHtml(question.prompt)}</textarea></label><label>Fokus<input data-field="focus" value="${escapeHtml(question.focus || "")}" /></label>${Array.isArray(question.criteria) && question.criteria.length ? `<div class="q-criteria-chip">Rubrik yang diukur soal ini: ${question.criteria.map((c) => (typeof c === "string" ? c : c.name || prettifyId(c.id))).map(escapeHtml).join(" · ")}</div>` : ""}<label>Learning outcome (kompetensi yang diukur)<textarea data-field="outcome" rows="2">${escapeHtml(question.outcome || "")}</textarea></label><label>Rubrik penilaian soal ini<div class="rubrik-preview" style="margin-top:6px;">${question.rubric ? renderRubricTable(question.rubric) : ""}</div><button type="button" class="secondary-button rubrik-builder-toggle" data-index="${index}" style="margin-top: 6px; font-size: 0.85rem;">✏️ Edit Rubrik</button></label><div class="rubrik-builder rubrik-builder-${index}" style="display: none;"></div><label>Jawaban ideal<textarea data-field="ideal" rows="3">${escapeHtml(question.ideal || "")}</textarea></label><label class="probing-toggle check-row"><input type="checkbox" data-field="probing" ${question.probing ? "checked" : ""} /><span>⚡ <strong>Aktifkan probing</strong> — siswa mendapat 1 pertanyaan lanjutan berbasis jawabannya setelah menjawab soal ini.</span></label></article>`).join(""); renderReviewSummary(ctx); }
