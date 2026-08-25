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
import { saveCurrentQuestionsToBank } from "./question-bank.js";

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
  if (els.saveToBankBtn) {
    els.saveToBankBtn.addEventListener("click", () => saveCurrentQuestionsToBank(ctx));
  }

  // Delete a single question from the editor (event delegation).
  els.editableQuestionList.addEventListener("click", (event) => {
    const deleteBtn = event.target.closest(".delete-question");
    if (!deleteBtn) return;
    handleDeleteQuestion(ctx, Number(deleteBtn.dataset.index));
  });

  // Rubrik builder toggle (event delegation).
  els.editableQuestionList.addEventListener("click", (event) => {
    const toggle = event.target.closest(".rubrik-builder-toggle");
    if (!toggle) return;
    const index = toggle.dataset.index;
    const builder = document.querySelector(`.rubrik-builder-${index}`);
    if (!builder) return;
    const isHidden = builder.style.display === "none" || !builder.style.display;
    builder.style.display = isHidden ? "grid" : "none";
    if (isHidden) renderRubrikBuilder(builder, ctx.pendingQuestions[index]?.rubric || "");
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
  showQuestionStreamPlaceholder(ctx);
  try {
    const questions = await generateQuestionsWithFallback(ctx, config);
    ctx.pendingAssessmentConfig = config;
    ctx.pendingQuestions = questions;
    finishQuestionStream(ctx);
    // Brief pause so the user sees the completed stream before switching.
    await new Promise((resolve) => setTimeout(resolve, 600));
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
  // Sync wizard edit fields back to config
  if (els.editIsTryout) ctx.pendingAssessmentConfig.isTryout = els.editIsTryout.checked;
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
  const defaultText = "AI Rubric Alignment";
  setButtonLoading(els.improveQuestionSet, true, "Menyelaraskan rubrik & soal...", defaultText);
  showQuestionStreamPlaceholder(ctx);
  try {
    ctx.pendingQuestions = await alignRubricWithFallback(ctx, ctx.pendingAssessmentConfig, ctx.pendingQuestions);
    finishQuestionStream(ctx);
    await new Promise((resolve) => setTimeout(resolve, 500));
    hideStreamPanel(ctx, els.aiStreamPanel);
    renderQuestionEditor(ctx);
  } catch (error) {
    showToast(error.message);
  } finally {
    setButtonLoading(els.improveQuestionSet, false, "Menyelaraskan rubrik & soal...", defaultText);
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
    // Pemetaan soal↔rubrik dipertahankan saat diedit ulang (mekanisme alignment).
    criteria: ctx.pendingQuestions[index]?.criteria || [],
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
  if (els.editIsTryout) {
    els.editIsTryout.checked = !!ctx.pendingAssessmentConfig.isTryout;
  }
  els.editableQuestionList.innerHTML = ctx.pendingQuestions.map((question, index) => `
    <article class="feedback-card editable-question">
      <div class="question-card-header">
        <strong>Soal ${index + 1}</strong>
        <button type="button" class="action-button danger-button delete-question" data-index="${index}" aria-label="Hapus soal ${index + 1}">Hapus</button>
      </div>
      <label>Pertanyaan<textarea data-field="prompt" rows="3">${escapeHtml(question.prompt)}</textarea></label>
      <label>Fokus<input data-field="focus" value="${escapeHtml(question.focus || "")}" /></label>
      ${
        Array.isArray(question.criteria) && question.criteria.length
          ? `<div class="q-criteria-chip">Rubrik yang diukur soal ini: ${question.criteria
              .map((c) => (typeof c === "string" ? c : c.name || c.id))
              .map(escapeHtml)
              .join(" · ")}</div>`
          : ""
      }
      <label>Learning outcome (kompetensi yang diukur)<textarea data-field="outcome" rows="2">${escapeHtml(question.outcome || "")}</textarea></label>
      <label>Rubrik penilaian soal ini
  <textarea data-field="rubric" rows="3">${escapeHtml(question.rubric || "")}</textarea>
  <button type="button" class="secondary-button rubrik-builder-toggle" data-index="${index}" style="margin-top: 6px; font-size: 0.85rem;">✏️ Buka Builder Rubrik</button>
</label>
<div class="rubrik-builder rubrik-builder-${index}" style="display: none;"></div>
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
        <div><dt>Retake</dt><dd>${config.allowRetakes ? "Diizinkan (tanpa batas)" : "Tidak diizinkan"}</dd></div>
        ${config.maxAttempts > 0 && !config.allowRetakes ? `<div><dt>Jumlah percobaan</dt><dd>${config.maxAttempts} kali</dd></div>` : ""}
      </dl>
    </div>
    <div class="review-block">
      <h4>Soal</h4>
      <p class="review-count">${answered} dari ${total} soal sudah diisi.</p>
      ${renderAlignmentCoverage(ctx)}
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

/**
 * Parser ringan teks rubrik menjadi daftar nama kriteria. Memakai pola yang
 * sama dengan enforcement soal↔rubrik: hilangkan angka/bobot diawal/akhir.
 */
function parseRubricNames(text) {
  return String(text || "")
    .split(/[;\n,]+/)
    .map((s) =>
      s
        .replace(/^\d+(\.\d+)?\s*%?\s*/, "")
        .replace(/\s*[-:–]\s*(\d+(\.\d+)?\s*%?)?$/, "")
        .replace(/\s*\(?\d+(\.\d+)?\s*%?\s*\)?$/, "")
        .trim()
    )
    .filter((s) => s.length > 2);
}

/** Normalisasi nama kriteria untuk perbandingan case/whitespace-insensitive. */
function normalizeCoverageKey(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Ringkasan cakupan rubrik: kriteria mana yang diukur oleh soal mana.
 * Peringatan muncul bila ada kriteria pada rubrik per-soal (yang benar-benar
 * dipakai penilaian) yang tidak diukur soal manapun. Sumber kriteria diambil
 * dari rubrik per-soal saat ini, BUKAN config.rubric global yang bisa basi —
 * sehingga ketika guru menghapus satu kriteria dari teks rubrik soal, peringatan
 * langsung menyesuaikan (align dgn mekanisme enforceRubricAlignment).
 */
function renderAlignmentCoverage(ctx) {
  const { pendingQuestions } = ctx;
  const questionsWithCriteria = pendingQuestions.filter(
    (q) => Array.isArray(q.criteria) && q.criteria.length > 0
  );
  if (questionsWithCriteria.length === 0) return "";
  const covered = new Set();
  questionsWithCriteria.forEach((q) =>
    q.criteria.forEach((c) => covered.add(normalizeCoverageKey(typeof c === "string" ? c : c.name || c.id)))
  );
  // Kriteria yang "diharapkan" = penyatuan nama kriteria dari seluruh rubrik
  // per-soal terkini (apa yang dipakai evaluator). Tidak memakai config.rubric
  // global karena nilainya bisa basi dari saat penilaian dibuka.
  const rubricCriteria = [...new Set(pendingQuestions.flatMap((q) => parseRubricNames(q.rubric)))];
  if (rubricCriteria.length === 0) return "";
  const uncovered = rubricCriteria.filter((name) => !covered.has(normalizeCoverageKey(name)));
  if (uncovered.length === 0) return "";
  return `
    <p class="review-align-warning">⚠ Kriteria rubrik berikut belum diukur oleh soal manapun:
      <strong>${uncovered.map((n) => escapeHtml(n)).join("; ")}</strong>.
      Soal baru sebaiknya menanyakannya agar penilaian mencakup seluruh rubrik.</p>
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

  const button = els.recommendOutcomes;
  const defaultText = "Rekomendasikan kompetensi";
  setButtonLoading(button, true, "Membuat rekomendasi...", defaultText);
  showRecommendStreamPlaceholder(ctx);
  try {
    const recommendation = await recommendConfigWithFallback(ctx, topic, els.difficulty.value);
    if (target === "outcomes" || target === "both") els.outcomes.value = recommendation.outcomes;
    hideStreamPanel(ctx, els.recommendStreamPanel);
  } finally {
    setButtonLoading(button, false, "Membuat rekomendasi...", defaultText);
  }
}

export async function recommendConfigWithFallback(ctx, topic, difficulty) {
  let raw = "";
  let recommendation = null;
  try {
    await streamAssessmentAction({
      action: "recommend-assessment-config",
      payload: { topic, difficulty },
      onChunk: (text) => {
        raw += text;
        renderRecommendStream(ctx, raw);
      },
      onResult: (data) => {
        recommendation = data?.recommendation || null;
      },
    });
    return recommendation;
  } catch (error) {
    showToast(`AI belum tersedia, memakai rekomendasi lokal. Detail: ${error.message}`);
    return recommendFallbackConfig(topic, difficulty);
  }
}

/**
 * Show the animated placeholder skeleton while AI is generating a recommendation.
 */
function showRecommendStreamPlaceholder(ctx) {
  const { els } = ctx;
  if (els.recommendStreamPlaceholder) els.recommendStreamPlaceholder.classList.remove("hidden");
  if (els.recommendStreamContent) els.recommendStreamContent.textContent = "";
  if (els.recommendStreamPanel) els.recommendStreamPanel.classList.remove("hidden");
}

/**
 * Incrementally render the streamed recommendation JSON into a readable preview.
 */
function renderRecommendStream(ctx, raw) {
  const { els } = ctx;
  if (!els.recommendStreamContent) return;
  if (els.recommendStreamPlaceholder && !els.recommendStreamPlaceholder.classList.contains("hidden")) {
    els.recommendStreamPlaceholder.classList.add("hidden");
  }

  const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) return;

  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return;
  }

  const parts = [];
  if (parsed.outcomes) parts.push(`📋 Kompetensi:\n${parsed.outcomes}`);
  if (parsed.rubric) parts.push(`\n📐 Rubrik:\n${parsed.rubric}`);
  els.recommendStreamContent.textContent = parts.join("\n");
  els.recommendStreamContent.scrollTop = els.recommendStreamContent.scrollHeight;
}

export async function generateQuestionsWithFallback(ctx, config) {
  let raw = "";
  let questions = null;
  try {
    await streamAssessmentAction({
      action: "generate-questions",
      payload: config,
      onChunk: (text) => {
        raw += text;
        renderStreamedQuestionsFromRaw(ctx, raw);
      },
      onResult: (data) => {
        questions = Array.isArray(data?.questions) ? data.questions : null;
      },
    });
    return questions;
  } catch (error) {
    showToast(`AI belum tersedia, memakai generator lokal. Detail: ${error.message}`);
    return generateFallbackQuestions(config);
  }
}

/**
 * Incrementally parse the streamed JSON and render each question card as soon
 * as its "prompt" field becomes available.
 */
function renderStreamedQuestionsFromRaw(ctx, raw) {
  const { els } = ctx;
  if (!els.aiStreamQuestions) return;
  // Hide the placeholder once real content starts arriving.
  if (els.aiStreamPlaceholder && !els.aiStreamPlaceholder.classList.contains("hidden")) {
    els.aiStreamPlaceholder.classList.add("hidden");
  }

  const trimmed = raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) return;

  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return; // JSON not complete yet — keep waiting for more chunks.
  }

  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
  questions.forEach((q, index) => renderStreamedQuestion(ctx, index, q));
}

export async function improveQuestionsWithFallback(ctx, config, questions) {
  let raw = "";
  let improved = null;
  try {
    await streamAssessmentAction({
      action: "improve-questions",
      payload: { config, questions },
      onChunk: (text) => {
        raw += text;
        renderStreamedQuestionsFromRaw(ctx, raw);
      },
      onResult: (data) => {
        improved = Array.isArray(data?.questions) ? data.questions : null;
      },
    });
    return improved;
  } catch (error) {
    showToast(`AI belum tersedia, memakai question set sebelumnya. Detail: ${error.message}`);
    return questions;
  }
}

/**
 * AI Rubric Alignment — kalibrasi soal↔rubrik. Server meminta model menandai
 * SUBSET kriteria rubrik yang sungguh diukur tiap soal (dan memperbaiki
 * substansi soal bila tak selaras), lalu enforcement deterministik menjamin
 * cakupan rubrik utuh tanpa menghukum soal "sebutkan" atas kriteria yang tak
 * ditanyakannya.
 */
export async function alignRubricWithFallback(ctx, config, questions) {
  let raw = "";
  let aligned = null;
  try {
    await streamAssessmentAction({
      action: "align-rubric",
      payload: { config, questions },
      onChunk: (text) => {
        raw += text;
        renderStreamedQuestionsFromRaw(ctx, raw);
      },
      onResult: (data) => {
        aligned = Array.isArray(data?.questions) ? data.questions : null;
      },
    });
    return aligned;
  } catch (error) {
    showToast(`AI belum tersedia, memakai alignment deterministik. Detail: ${error.message}`);
    return questions;
  }
}

// ---------------------------------------------------------------------------
// Streaming panel helpers
// ---------------------------------------------------------------------------

function hideStreamPanel(ctx, panel) {
  if (panel) panel.classList.add("hidden");
}

/**
 * Show the animated placeholder skeleton while AI is generating questions.
 */
function showQuestionStreamPlaceholder(ctx) {
  const { els } = ctx;
  if (els.aiStreamPlaceholder) els.aiStreamPlaceholder.classList.remove("hidden");
  if (els.aiStreamQuestions) els.aiStreamQuestions.innerHTML = "";
  if (els.aiStreamPanel) {
    els.aiStreamPanel.classList.remove("hidden");
    els.aiStreamPanel.classList.remove("ai-stream-done");
  }
}

/**
 * Hide the placeholder skeleton once streaming begins producing content.
 */
function hideQuestionStreamPlaceholder(ctx) {
  if (ctx.els.aiStreamPlaceholder) ctx.els.aiStreamPlaceholder.classList.add("hidden");
}

/**
 * Render a single question card progressively as it streams in.
 */
function renderStreamedQuestion(ctx, index, question) {
  const { els } = ctx;
  if (!els.aiStreamQuestions) return;
  const prompt = (question?.prompt || "").trim();
  if (!prompt) return;

  const existing = els.aiStreamQuestions.querySelector(`[data-q-index="${index}"]`);
  const card = existing || document.createElement("div");
  card.className = "ai-stream-question";
  card.dataset.qIndex = index;
  card.innerHTML = `
    <span class="ai-q-num">${index + 1}</span>
    <span class="ai-q-text">${escapeHtml(prompt)}</span>
  `;
  if (!existing) els.aiStreamQuestions.appendChild(card);
}

/**
 * Mark the stream as complete: apply the slide-in animation and focus the
 * first question card.
 */
function finishQuestionStream(ctx) {
  const { els } = ctx;
  if (els.aiStreamPanel) els.aiStreamPanel.classList.add("ai-stream-done");
  const first = els.aiStreamQuestions?.querySelector(".ai-stream-question");
  if (first) {
    first.scrollIntoView({ behavior: "smooth", block: "center" });
    first.classList.add("ai-stream-focus");
  }
}

// ---------------------------------------------------------------------------
// Rubrik Visual Builder (#5)
// ---------------------------------------------------------------------------

/**
 * Convert a free-text rubric into structured criteria rows.
 * Tolerant parser: "Nama 40%", "Nama: 40%", "40% Nama".
 */
export function parseRubricToCriteria(text) {
  const lines = String(text || "").split(/\n+/).filter((l) => l.trim());
  if (!lines.length) {
    lines.push("");
  }
  return lines.map((line, i) => {
    let name = line.trim();
    let weight = 0;
    let m = name.match(/^(.+?)\s*[-:–]?\s*\(?\s*(\d+(?:\.\d+)?)\s*%?\s*\)?$/);
    if (m) {
      name = m[1].trim();
      weight = Number(m[2]);
    } else {
      m = name.match(/^(\d+(?:\.\d+)?)\s*%?\s+(.+)$/);
      if (m) {
        weight = Number(m[1]);
        name = m[2].trim();
      }
    }
    return { id: `c${i + 1}`, name, weight };
  });
}

/** Format criteria as free-text rubric for the hidden textarea. */
function formatCriteriaToText(criteria) {
  return criteria.map((c) => `${c.name} ${c.weight}%`).join("\n");
}

/**
 * Render the structured rubrik builder for a question.
 * Updates the hidden rubric textarea as the user edits weights.
 */
export function renderRubrikBuilder(el, rubricText) {
  const criteria = parseRubricToCriteria(rubricText);
  el.dataset.ready = "1";
  el.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <strong style="font-size:0.9rem;">Kriteria Rubrik</strong>
      <button type="button" class="secondary-button rubrik-add" style="padding:4px 12px; font-size:0.85rem;">+ Tambah</button>
    </div>
    <div class="rubrik-rows">
      ${criteria.map((c, i) => rubrikRowHtml(c, i)).join("")}
    </div>
    <div class="rubrik-weight-sum" data-sum></div>
  `;

  el.querySelector(".rubrik-add").addEventListener("click", () => {
    const rows = el.querySelector(".rubrik-rows");
    const idx = rows.children.length;
    const row = document.createElement("div");
    row.innerHTML = rubrikRowHtml({ id: `c${idx + 1}`, name: "", weight: 0 }, idx);
    rows.appendChild(row.firstElementChild);
    updateRubrik(el);
  });

  el.querySelector(".rubrik-rows").addEventListener("input", (e) => updateRubrik(el));
  el.querySelector(".rubrik-rows").addEventListener("click", (e) => {
    if (e.target.closest(".rubrik-delete")) {
      const row = e.target.closest(".rubrik-criterion");
      const idx = row.querySelector(".rubrik-index").dataset.index;
      row.remove();
      // Re-index
      el.querySelectorAll(".rubrik-criterion").forEach((r, i) => {
        r.querySelector(".rubrik-index").dataset.index = i;
        r.querySelector(".rubrik-drag-num").textContent = i + 1;
      });
      updateRubrik(el);
    }
  });
  updateRubrik(el);
}

function rubrikRowHtml(c, idx) {
  return `
    <div class="rubrik-criterion" draggable="true">
      <span class="rubrik-index" data-index="${idx}" aria-hidden="true"></span>
      <input type="text" class="rubrik-name" placeholder="Nama kriteria (mis. Ketepatan konsep)" value="${escapeHtml(c.name || "")}" ${idx === 0 ? "autofocus" : ""} />
      <label style="display:flex; align-items:center; gap:4px; font-size:0.85rem; color:var(--muted);">
        <input type="number" class="weight-input rubrik-weight" min="0" max="100" step="1" value="${c.weight}" aria-label="Bobot %" />
        %
      </label>
      <button type="button" class="action-button danger-button rubrik-delete" aria-label="Hapus kriteria">&times;</button>
    </div>
  `;
}

/** Rebuild the text from rows and sync to the question's rubric textarea. */
function updateRubrik(el) {
  const rows = [...el.querySelectorAll(".rubrik-criterion")];
  const sum = rows.reduce((acc, r) => {
    const w = Number(r.querySelector(".rubrik-weight").value || 0);
    return acc + (isFinite(w) ? w : 0);
  }, 0);
  const sumEl = el.querySelector("[data-sum]");
  sumEl.textContent = `Total bobot: ${sum}% ${sum === 100 ? "✓" : sum > 100 ? "(kelebihan)" : "(kurang)"}`;
  sumEl.className = `rubrik-weight-sum ${sum === 100 ? "valid" : "invalid"}`;

  // Write back to the hidden rubric textarea of this question.
  const questionEl = el.closest(".editable-question");
  const rubricTextarea = questionEl?.querySelector("[data-field='rubric']");
  if (rubricTextarea) {
    const criteria = rows.map((r) => ({
      name: r.querySelector(".rubrik-name").value.trim(),
      weight: Number(r.querySelector(".rubrik-weight").value || 0),
    }));
    rubricTextarea.value = formatCriteriaToText(criteria);
  }
}