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

let _wizardCtx = null;

/**
 * Assessment creation wizard: context form, AI question generation,
 * manual editing, review summary, and publish.
 */
export function bindAssessmentWizardEvents(ctx) {
  _wizardCtx = ctx;
  const { els } = ctx;

  els.form.addEventListener("submit", (event) => handleAssessmentSubmit(ctx, event));
  if (els.createManualAssessment) {
    els.createManualAssessment.addEventListener("click", (event) => handleCreateManualAssessment(ctx, event));
  }
  els.saveQuestionSet.addEventListener("click", () => savePendingQuestionSet(ctx));
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
    if (isHidden) {
      builder.dataset.qIndex = index;
      renderRubrikBuilder(builder, ctx.pendingQuestions[index]?.rubric || "");
    } else {
      // Builder closed: refresh the preview table from updated data
      const preview = toggle.closest("label")?.querySelector(".rubrik-preview");
      if (preview && ctx.pendingQuestions[index]?.rubric) {
        preview.innerHTML = renderRubricTable(ctx.pendingQuestions[index].rubric);
      }
    }
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
    ctx.pendingQuestions = questions.map((q) => ({
      ...q,
      rubric: q.rubric ? convertLegacyRubricToJson(q.rubric) : "",
    }));
    finishQuestionStream(ctx);
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
    rubric: ctx.pendingQuestions[index]?.rubric || "",
    ideal: item.querySelector("[data-field='ideal']").value.trim(),
    criteria: ctx.pendingQuestions[index]?.criteria || [],
    probing: item.querySelector("[data-field='probing']")?.checked ?? !!ctx.pendingQuestions[index]?.probing,
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
              .map((c) => (typeof c === "string" ? c : c.name || prettifyId(c.id)))
              .map(escapeHtml)
              .join(" · ")}</div>`
          : ""
      }
      <label>Learning outcome (kompetensi yang diukur)<textarea data-field="outcome" rows="2">${escapeHtml(question.outcome || "")}</textarea></label>
<label>Rubrik penilaian soal ini
  <div class="rubrik-preview" style="margin-top:6px;">${question.rubric ? renderRubricTable(question.rubric) : ""}</div>
  <button type="button" class="secondary-button rubrik-builder-toggle" data-index="${index}" style="margin-top: 6px; font-size: 0.85rem;">✏️ Edit Rubrik</button>
</label>
<div class="rubrik-builder rubrik-builder-${index}" style="display: none;"></div>
<label>Jawaban ideal<textarea data-field="ideal" rows="3">${escapeHtml(question.ideal || "")}</textarea></label>
      <label class="probing-toggle check-row">
        <input type="checkbox" data-field="probing" ${question.probing ? "checked" : ""} />
        <span>⚡ <strong>Aktifkan probing</strong> — siswa mendapat 1 pertanyaan lanjutan berbasis jawabannya setelah menjawab soal ini.</span>
      </label>
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
            ${q.probing ? `<span class="review-probing-badge">⚡ probing aktif</span>` : ""}
          </li>
        `).join("")}
      </ol>
    </div>
  `;
}

/**
 * Parser ringan teks rubrik menjadi daftar nama kriteria.
 * Mendukung JSON v2 (dari gradation table) dan legacy text format.
 */
function parseRubricNames(text) {
  if (!text) return [];
  const t = String(text).trim();
  // JSON v2 format
  if (t.startsWith("{")) {
    try {
      const p = JSON.parse(t);
      if (p.version === "2" && Array.isArray(p.criteria)) {
        return p.criteria.map((c) => c.name || "").filter(Boolean);
      }
    } catch { /* fall through */ }
  }
  // Legacy text format
  return t
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
// Rubrik Visual Builder with Gradation Table (#5 v2)
// ---------------------------------------------------------------------------

const DEFAULT_LEVELS = [
  { score: 4, label: "Sangat Baik", descriptor: "" },
  { score: 3, label: "Baik", descriptor: "" },
  { score: 2, label: "Cukup", descriptor: "" },
  { score: 1, label: "Kurang", descriptor: "" },
];

function fillLevelDescriptors(criterionName, levels) {
  const name = criterionName || "Kriteria";
  const lower = name.toLowerCase();
  const templates = [
    `${name} sangat baik, lengkap, dan tepat`,
    `${name} baik dan memadai`,
    `${name} cukup, namun masih perlu pengembangan`,
    `${name} kurang, perlu perbaikan signifikan`,
  ];
  return levels.map((l, i) => ({
    ...l,
    descriptor: l.descriptor || templates[i] || "",
  }));
}

/**
 * Convert a rubric string (JSON v2 or legacy text) into structured criteria.
 * JSON v2: {"version":"2","criteria":[{id,name,weight,levels:[{score,label,descriptor}]}]}
 * Legacy: "Nama 40%"
 */
export function parseRubricToCriteria(text) {
  if (!text || !text.trim()) {
    return [{ id: "c1", name: "", weight: 0, levels: fillLevelDescriptors("", JSON.parse(JSON.stringify(DEFAULT_LEVELS))) }];
  }
  const t = text.trim();
  if (t.startsWith("{")) {
    try {
      const p = JSON.parse(t);
      if (p.version === "2" && Array.isArray(p.criteria)) {
        return p.criteria.map((c, i) => ({
          id: c.id || `c${i + 1}`,
          name: c.name || "",
          weight: c.weight || 0,
          levels: Array.isArray(c.levels) && c.levels.length === 4
            ? fillLevelDescriptors(c.name || "", c.levels.map((l) => ({ score: l.score, label: l.label || "", descriptor: l.descriptor || "" })))
            : fillLevelDescriptors(c.name || "", JSON.parse(JSON.stringify(DEFAULT_LEVELS))),
        }));
      }
    } catch { /* fall through */ }
  }
  // Smart split: only split on commas/semicolons that are followed by a word character
  // (not commas inside parentheses). This prevents splitting criterion names that
  // contain commas in parenthetical descriptions.
  const lines = [];
  const raw = t;
  let depth = 0, start = 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '(' || raw[i] === '[' || raw[i] === '{') depth++;
    else if (raw[i] === ')' || raw[i] === ']' || raw[i] === '}') depth--;
    else if (depth === 0 && (raw[i] === ',' || raw[i] === ';' || raw[i] === '\n')) {
      const seg = raw.slice(start, i).trim();
      if (seg) lines.push(seg);
      start = i + 1;
    }
  }
  const last = raw.slice(start).trim();
  if (last) lines.push(last);
  if (!lines.length) lines.push("");
  return lines.map((line, i) => {
    let name = line.trim();
    name = name.replace(/^[•\-*]\s*/, "").replace(/[.!]+$/, "").trim();
    // Strip trailing comma before percentage (e.g. "Ketepatan konsep, 40%")
    name = name.replace(/,\s*(?=\d+\s*%?$)/, " ").trim();
    let weight = 0;
    let m = name.match(/^(.+?)\s*[-:–]?\s*\(?\s*(\d+(?:\.\d+)?)\s*%?\s*\)?$/);
    if (m) { name = m[1].trim(); weight = Number(m[2]); }
    else { m = name.match(/^(\d+(?:\.\d+)?)\s*%?\s+(.+)$/); if (m) { weight = Number(m[1]); name = m[2].trim(); } }
    return { id: `c${i + 1}`, name, weight, levels: fillLevelDescriptors(name, JSON.parse(JSON.stringify(DEFAULT_LEVELS))) };
  });
}

function formatCriteriaToJson(criteria) {
  return JSON.stringify({ version: "2", criteria });
}

/**
 * Render the gradation table rubrik builder.
 * Table: rows = criteria, cols = Sangat Baik | Baik | Cukup | Kurang + descriptor textareas.
 */
export function renderRubrikBuilder(el, rubricText) {
  const criteria = parseRubricToCriteria(rubricText);
  const levels = criteria[0]?.levels || DEFAULT_LEVELS;
  el.dataset.ready = "1";
  el.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <strong style="font-size:0.9rem;">Rubrik dengan Gradasi</strong>
      <button type="button" class="secondary-button rubrik-add" style="padding:4px 12px; font-size:0.85rem;">+ Tambah Kriteria</button>
    </div>
    <div class="rubrik-gradation-wrap">
      <table class="rubrik-gradation">
        <thead>
          <tr>
            <th style="min-width:140px;">Kriteria</th>
            <th style="min-width:40px;">Bobot</th>
            ${levels.map((l) => `<th class="rubrik-level-${l.score}">${escapeHtml(l.label)} (${l.score})</th>`).join("")}
            <th style="width:32px;"></th>
          </tr>
        </thead>
        <tbody class="rubrik-rows">
          ${criteria.map((c, i) => rubrikGradationRow(c, i, levels)).join("")}
        </tbody>
      </table>
    </div>
    <div class="rubrik-weight-sum" data-sum></div>
  `;

  el.querySelector(".rubrik-add").addEventListener("click", () => {
    const tbody = el.querySelector(".rubrik-rows");
    const idx = tbody.children.length;
    const row = document.createElement("tr");
    row.innerHTML = rubrikGradationRow({ id: `c${idx + 1}`, name: "", weight: 0, levels: JSON.parse(JSON.stringify(DEFAULT_LEVELS)) }, idx, levels);
    tbody.appendChild(row);
    updateRubrik(el);
  });
  el.querySelector(".rubrik-rows").addEventListener("input", () => updateRubrik(el));
  el.querySelector(".rubrik-rows").addEventListener("click", (e) => {
    if (e.target.closest(".rubrik-delete")) { e.target.closest("tr").remove(); updateRubrik(el); }
  });
  updateRubrik(el);
}

function rubrikGradationRow(c, idx, levels) {
  return `
    <tr class="rubrik-row">
      <td><input type="text" class="rubrik-name" placeholder="Nama kriteria" value="${escapeHtml(c.name || "")}" style="width:100%;" /></td>
      <td><input type="number" class="rubrik-weight" min="0" max="100" step="1" value="${c.weight}" aria-label="Bobot %" style="width:50px;" />%</td>
      ${levels.map((l, li) => `
        <td class="rubrik-level-cell rubrik-level-${l.score}">
          <textarea class="rubrik-desc" rows="2" placeholder="Deskripsi ${l.label.toLowerCase()}..." aria-label="${escapeHtml(l.label)}">${escapeHtml((c.levels && c.levels[li]?.descriptor) || "")}</textarea>
        </td>
      `).join("")}
      <td><button type="button" class="action-button danger-button rubrik-delete" aria-label="Hapus">&times;</button></td>
    </tr>
  `;
}

function updateRubrik(el) {
  const rows = [...el.querySelectorAll(".rubrik-rows tr")];
  const levels = DEFAULT_LEVELS;
  const criteria = rows.map((r, i) => ({
    id: `c${i + 1}`,
    name: r.querySelector(".rubrik-name").value.trim(),
    weight: Number(r.querySelector(".rubrik-weight").value || 0),
    levels: levels.map((l, li) => ({
      score: l.score,
      label: l.label,
      descriptor: r.querySelectorAll(".rubrik-desc")[li]?.value?.trim() || "",
    })),
  }));
  const sum = criteria.reduce((a, c) => a + (isFinite(c.weight) ? c.weight : 0), 0);
  const sumEl = el.querySelector("[data-sum]");
  sumEl.textContent = `Total bobot: ${sum}% ${sum === 100 ? "✓" : sum > 100 ? "(kelebihan)" : "(kurang)"}`;
  sumEl.className = `rubrik-weight-sum ${sum === 100 ? "valid" : "invalid"}`;

  const qIndex = el.dataset.qIndex;
  if (_wizardCtx && qIndex !== undefined && _wizardCtx.pendingQuestions[qIndex]) {
    _wizardCtx.pendingQuestions[qIndex].rubric = formatCriteriaToJson(criteria);
  }
}

/**
 * Convert a legacy text rubric ("Nama 40%") to JSON v2 format.
 * If already JSON v2, returns as-is.
 */
function convertLegacyRubricToJson(text) {
  if (!text || !text.trim()) return "";
  const t = text.trim();
  if (t.startsWith("{")) return t; // already JSON
  try {
    const criteria = parseRubricToCriteria(t);
    return formatCriteriaToJson(criteria);
  } catch {
    return t;
  }
}