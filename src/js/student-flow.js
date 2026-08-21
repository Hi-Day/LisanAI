import {
  evaluateAssessmentWithAI,
  saveSubmissionToDatabase,
} from "./api.js";
import { createSubmission } from "./assessment-factory.js";
import { setButtonLoading } from "./dom.js";
import { evaluateFallbackAssessment } from "./fallback-assessment.js";
import { renderMonitoring, renderQuestion, renderStudentHistory, showResult } from "./render.js";
import { showToast } from "./toast.js";
import { escapeHtml, formatTime } from "./utils.js";
import { isAssessmentLocked, renderCurrentState } from "./app-context.js";

/**
 * Student answering flow: question navigation, recorder, timer, and submission.
 */
export function bindStudentFlowEvents(ctx) {
  const { els } = ctx;

  if (els.studentAssessmentGrid) {
    els.studentAssessmentGrid.addEventListener("click", async (e) => {
      const btn = e.target.closest(".start-assessment-btn") || e.target.closest(".assessment-card");
      if (btn) {
        const assessment = ctx.state.assessments.find((item) => item.id === btn.dataset.id);
        if (assessment && isAssessmentLocked(ctx, assessment)) {
          if (assessment.status === "closed") {
            showToast("Akses ke penilaian ini sedang ditutup oleh guru.");
          } else {
            showToast("Penilaian ini sudah dikumpulkan dan tidak bisa dibuka lagi.");
          }
          return;
        }

        ctx.recorder.stop();
        ctx.session.selectAssessment(btn.dataset.id);
        els.resultPanel.classList.add("hidden");
        await renderCurrentState(ctx);
        await startRecorderForCurrentAssessment(ctx);
        startQuestionTimer(ctx);
        ctx.questionStartTime = Date.now();
      }
    });
  }

  if (els.backToDashboard) {
    els.backToDashboard.addEventListener("click", async () => {
      ctx.recorder.stop();
      stopQuestionTimer(ctx);
      ctx.session.currentAssessmentId = null;
      await renderCurrentState(ctx);
    });
  }

  els.saveAnswer.addEventListener("click", async () => {
    ctx.recorder.stop();
    await saveCurrentAnswer(ctx);
    const assessment = ctx.session.getCurrentAssessment();
    const isLastQuestion = assessment && ctx.session.currentQuestionIndex === assessment.questions.length - 1;
    if (isLastQuestion) {
      stopQuestionTimer(ctx);
      confirmAndFinishAssessment(ctx);
      return;
    }
    ctx.session.goNext();
    renderQuestion(els, ctx.session.getCurrentAssessment(), ctx.session);
    await startRecorderForCurrentAssessment(ctx);
    startQuestionTimer(ctx);
    ctx.questionStartTime = Date.now();
  });

  els.finishAssessment.addEventListener("click", (e) => {
    stopQuestionTimer(ctx);
    confirmAndFinishAssessment(ctx);
  });

  if (els.testMicButton) {
    els.testMicButton.addEventListener("click", async () => {
      const result = await ctx.recorder.testMicrophone();
      renderMicDiagnostics(ctx, result);
    });
  }
}

export async function saveCurrentAnswer(ctx) {
  const audio = await ctx.recorder.getAudioBase64();
  const elapsed = Math.round((Date.now() - ctx.questionStartTime) / 1000);
  ctx.session.saveAnswer(ctx.els.answerText.value, audio, elapsed);
  ctx.recorder.clearAudio();
  ctx.questionStartTime = Date.now();
}

export async function startRecorderForCurrentAssessment(ctx) {
  const assessment = ctx.session.getCurrentAssessment();
  const isOralExam = assessment?.oralExamEnabled !== false;
  ctx.recorder.setEnabled(isOralExam);
  if (!isOralExam) return;

  ctx.recorder.resetStatus();
  try {
    await ctx.recorder.start();
  } catch (err) {
    console.warn("Could not start recorder:", err);
  }
}

export function getUnansweredCount(ctx) {
  const assessment = ctx.session.getCurrentAssessment();
  if (!assessment) return 0;
  return assessment.questions.reduce((count, _, index) => {
    const answer = ctx.session.currentAnswers[index];
    const hasText = (answer?.text || "").trim().length > 0;
    const hasAudio = Boolean(answer?.audio);
    return hasText || hasAudio ? count : count + 1;
  }, 0);
}

export function renderMicDiagnostics(ctx, result) {
  const { els } = ctx;
  if (!els.micStatus || !els.micDiagnostics) return;
  els.micDiagnostics.classList.remove("hidden");
  els.micDiagnostics.classList.toggle("ok", result.ok);
  els.micDiagnostics.classList.toggle("error", !result.ok);

  if (result.ok) {
    els.micStatus.textContent = "✓ Mikrofon siap";
    els.micStatus.className = "mic-status ok";
    els.micDiagnostics.innerHTML = `
      <strong>Mikrofon siap digunakan.</strong>
      <p>${escapeHtml(result.message)}</p>
    `;
    return;
  }

  els.micStatus.textContent = "✕ Mikrofon bermasalah";
  els.micStatus.className = "mic-status error";
  els.micDiagnostics.innerHTML = `
    <strong>Mikrofon belum bisa dipakai.</strong>
    <p>${escapeHtml(result.message)}</p>
    ${buildMicHelp(result.name)}
    <p style="margin-top: 8px;"><b>Alternatif:</b> Anda tetap bisa menjawab dengan mengetik jawaban di kolom transkripsi di bawah, lalu klik <b>Simpan & lanjut</b>.</p>
  `;
}

function buildMicHelp(errorName) {
  if (errorName === "NotAllowedError" || errorName === "SecurityError") {
    return `
      <ul>
        <li>Klik ikon gembok 🔒 di address bar browser.</li>
        <li>Ubah izin mikrofon menjadi <b>Allow</b> / <b>Izinkan</b>.</li>
        <li>Muat ulang halaman (F5) lalu coba lagi.</li>
      </ul>
    `;
  }
  if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
    return `
      <ul>
        <li>Pastikan mikrofon tersambung dan tidak dimatikan.</li>
        <li>Pilih perangkat input yang benar di pengaturan suara sistem.</li>
        <li>Di browser, buka <b>Settings &gt; Privacy &gt; Microphone</b> dan pilih perangkat.</li>
      </ul>
    `;
  }
  if (errorName === "NotReadableError" || errorName === "TrackStartError") {
    return `
      <ul>
        <li>Mikrofon mungkin sedang dipakai aplikasi lain (Zoom, Meet, dsb).</li>
        <li>Tutup aplikasi lain yang memakai mikrofon, lalu coba lagi.</li>
      </ul>
    `;
  }
  return `
    <ul>
      <li>Pastikan halaman dibuka di HTTPS atau localhost.</li>
      <li>Gunakan browser terbaru (Chrome/Edge) dan izinkan akses mikrofon.</li>
    </ul>
  `;
}

export function confirmAndFinishAssessment(ctx) {
  const assessment = ctx.session.getCurrentAssessment();
  if (!assessment) return;

  const unanswered = getUnansweredCount(ctx);
  const total = assessment.questions.length;

  saveCurrentAnswer(ctx).then(() => {
    const unansweredAfterSave = getUnansweredCount(ctx);

    if (unansweredAfterSave > 0) {
      const message = unansweredAfterSave === total
        ? "Belum ada satu pun soal yang dijawab. Anda akan mengumpulkan penilaian tanpa jawaban."
        : `${unansweredAfterSave} dari ${total} soal belum dijawab. Soal kosong akan dinilai 0.`;
      const proceed = confirm(`${message}\n\nYakin ingin menyelesaikan dan mengumpulkan penilaian sekarang?`);
      if (!proceed) return;
    } else {
      const proceed = confirm(`Semua ${total} soal sudah dijawab. Yakin ingin menyelesaikan dan mengumpulkan penilaian?`);
      if (!proceed) return;
    }

    handleFinishAssessment(ctx);
  });
}

export async function handleFinishAssessment(ctx) {
  const { els } = ctx;
  if (ctx.isEvaluating) return;
  const assessment = ctx.session.getCurrentAssessment();
  if (!assessment) return;

  ctx.isEvaluating = true;
  els.evaluationLoadingModal?.classList.remove("hidden");
  setButtonLoading(els.finishAssessment, true, "Menilai dengan AI...", "Selesaikan penilaian");

  try {
    await saveCurrentAnswer(ctx);
    const studentName = ctx.auth.user.role === "student"
      ? ctx.auth.user.name
      : els.studentName.value.trim() || "Siswa tanpa nama";
    const submission = await evaluateWithFallback(ctx, assessment, studentName);
    await saveSubmissionToDatabase(submission);
    ctx.state.submissions.push(submission);
    renderMonitoring(els, ctx.state);
    renderStudentHistory(els, ctx.state.submissions, ctx.auth.user.name);
    showResult(els, submission, ctx.auth);
    if (ctx.auth.user.role === "student") {
      ctx.session.currentAssessmentId = null;
      await renderCurrentState(ctx);
    }
  } catch (error) {
    showToast(`Gagal menyimpan hasil: ${error.message}`);
  } finally {
    ctx.isEvaluating = false;
    els.evaluationLoadingModal?.classList.add("hidden");
    setButtonLoading(els.finishAssessment, false, "Menilai dengan AI...", "Selesaikan penilaian");
  }
}

export async function evaluateWithFallback(ctx, assessment, studentName) {
  try {
    return await evaluateAssessmentWithAI(assessment, ctx.session.currentAnswers, studentName, createSubmission);
  } catch (error) {
    showToast(`AI belum tersedia, memakai penilaian lokal. Detail: ${error.message}`);
    return evaluateFallbackAssessment(assessment, ctx.session.currentAnswers, studentName, createSubmission);
  }
}

export function stopQuestionTimer(ctx) {
  const { els } = ctx;
  if (ctx.questionTimerInterval) {
    clearInterval(ctx.questionTimerInterval);
    ctx.questionTimerInterval = null;
  }
  if (els.timerDisplay) els.timerDisplay.style.animation = "none";
}

export function startQuestionTimer(ctx) {
  stopQuestionTimer(ctx);
  const { els } = ctx;
  const assessment = ctx.session.getCurrentAssessment();
  if (!assessment || !assessment.timeLimit || assessment.timeLimit <= 0) {
    if (els.timerDisplay) els.timerDisplay.style.display = "none";
    if (els.recordButton) els.recordButton.disabled = false;
    if (els.answerText) els.answerText.disabled = false;
    return;
  }

  const currentAnswer = ctx.session.currentAnswers[ctx.session.currentQuestionIndex];
  if (!currentAnswer) return;

  if (currentAnswer.timeLeft === undefined) {
    currentAnswer.timeLeft = assessment.timeLimit;
  }

  ctx.currentQuestionTimeLeft = currentAnswer.timeLeft;

  if (ctx.currentQuestionTimeLeft <= 0) {
    if (els.timerDisplay) {
      els.timerDisplay.style.display = "inline-flex";
      els.timerDisplay.style.color = "var(--rose)";
      els.timerDisplay.style.borderColor = "var(--rose)";
      els.timerDisplay.innerHTML = `<strong>Waktu Habis</strong>`;
    }
    if (els.recordButton) els.recordButton.disabled = true;
    if (els.answerText) els.answerText.disabled = true;
    ctx.recorder.stop();
    return;
  }

  if (els.timerDisplay) {
    els.timerDisplay.style.display = "inline-flex";
    els.timerDisplay.style.color = "var(--rose)";
    els.timerDisplay.style.borderColor = "var(--rose)";
    els.timerDisplay.innerHTML = `<strong>${formatTime(ctx.currentQuestionTimeLeft)}</strong> tersisa`;
  }
  if (els.recordButton) els.recordButton.disabled = false;
  if (els.answerText) els.answerText.disabled = false;

  ctx.questionTimerInterval = setInterval(() => {
    ctx.currentQuestionTimeLeft--;
    currentAnswer.timeLeft = ctx.currentQuestionTimeLeft;

    if (ctx.currentQuestionTimeLeft <= 0) {
      stopQuestionTimer(ctx);
      handleTimeOut(ctx);
    } else {
      if (els.timerDisplay) {
        els.timerDisplay.innerHTML = `<strong>${formatTime(ctx.currentQuestionTimeLeft)}</strong> tersisa`;
        if (ctx.currentQuestionTimeLeft <= 10) {
          els.timerDisplay.style.animation = "pulseRed 1s infinite";
        }
      }
    }
  }, 1000);
}

export async function handleTimeOut(ctx) {
  const { els } = ctx;
  if (els.timerDisplay) els.timerDisplay.innerHTML = `<strong>Waktu Habis</strong>`;
  ctx.recorder.stop();
  if (els.recordButton) els.recordButton.disabled = true;
  if (els.answerText) els.answerText.disabled = true;
  showToast("Waktu habis! Jawaban disimpan secara otomatis.", "error");

  await new Promise((resolve) => setTimeout(resolve, 200));
  await saveCurrentAnswer(ctx);

  const assessment = ctx.session.getCurrentAssessment();
  if (!assessment) return;

  const isLastQuestion = ctx.session.currentQuestionIndex === assessment.questions.length - 1;
  if (isLastQuestion) {
    await handleFinishAssessment(ctx);
  } else {
    ctx.session.goNext();
    renderQuestion(els, assessment, ctx.session);
    await startRecorderForCurrentAssessment(ctx);
    startQuestionTimer(ctx);
    ctx.questionStartTime = Date.now();
  }
}