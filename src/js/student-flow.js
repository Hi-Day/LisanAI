import {
  saveSubmissionToDatabase,
  streamAssessmentAction,
} from "./api.js";
import { createSubmission } from "./assessment-factory.js";
import { setButtonLoading } from "./dom.js";
import { evaluateFallbackAssessment, generateProbingFallback } from "./fallback-assessment.js";
import { createMicCheck } from "./mic-check.js";
import { formatDuration, renderMonitoring, renderQuestion, renderStudentHistory, showResult, renderEvaluationPreview, updateEvaluationProgress } from "./render.js";
import { showToast, showConfirmDialog } from "./toast.js";
import { escapeHtml, formatTime, prettifyId } from "./utils.js";
import { isAssessmentLocked } from "./app-context.js";
import { renderStudentState } from "./student-render-state.js";

/**
 * Student answering flow: question navigation, recorder, timer, and submission.
 */
export function bindStudentFlowEvents(ctx) {
  const { els } = ctx;

  ctx.micCheck = createMicCheck({
    volumeIndicator: els.preExamVolume,
    playback: els.preExamPlayback,
  });

  if (els.studentAssessmentGrid) {
    els.studentAssessmentGrid.addEventListener("click", (e) => {
      const btn = e.target.closest(".start-assessment-btn") || e.target.closest(".assessment-card");
      if (!btn) return;

      const assessment = ctx.state.assessments.find((item) => item.id === btn.dataset.id);
      if (!assessment) return;
      if (isAssessmentLocked(ctx, assessment)) {
        if (assessment.status === "closed") {
          showToast("Akses ke penilaian ini sedang ditutup oleh guru.");
        } else {
          showToast("Penilaian ini sudah dikumpulkan dan tidak bisa dibuka lagi.");
        }
        return;
      }

      // Soal dan timer belum jalan di sini: siswa harus lewat modal persiapan dulu.
      openPreExamModal(ctx, assessment, btn);
    });
  }

  bindPreExamEvents(ctx);

  if (els.backToDashboard) {
    els.backToDashboard.addEventListener("click", async () => {
      ctx.recorder.stop();
      stopQuestionTimer(ctx);
      resetProbingState(ctx);
      ctx.session.currentAssessmentId = null;
      renderStudentState(ctx);
    });
  }

  els.saveAnswer.addEventListener("click", async () => {
    ctx.recorder.stop();
    await saveCurrentAnswer(ctx);
    const assessment = ctx.session.getCurrentAssessment();
    const qi = ctx.session.currentQuestionIndex;
    const q = assessment?.questions?.[qi];

    if (ctx.inProbing) {
      // Probing sudah dijawab -> lanjut ke soal berikutnya.
      ctx.inProbing = false;
      ctx.probingPrompt = null;
      advanceAfterAnswer(ctx);
      return;
    }

    // Soal mengaktifkan probing dan probing belum dilakukan -> jalankan probing.
    if (q?.probing && !ctx.session.currentAnswers[qi]?.probing?.done) {
      await startProbingForCurrentQuestion(ctx);
      return;
    }

    advanceAfterAnswer(ctx);
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

/* ---------- Modal persiapan sebelum ujian dimulai ---------- */

function bindPreExamEvents(ctx) {
  const { els } = ctx;
  if (!els.preExamModal) return;

  els.preExamMicTest?.addEventListener("click", () => runPreExamMicTest(ctx));
  els.preExamStart?.addEventListener("click", () => startExamFromModal(ctx));
  els.preExamCancel?.addEventListener("click", () => closePreExamModal(ctx));
  els.preExamClose?.addEventListener("click", () => closePreExamModal(ctx));
  els.preExamModal.addEventListener("click", (event) => {
    if (event.target === els.preExamModal) closePreExamModal(ctx);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || els.preExamModal.classList.contains("hidden")) return;
    event.preventDefault();
    closePreExamModal(ctx);
  });
}

export function openPreExamModal(ctx, assessment, trigger = null) {
  const { els } = ctx;
  ctx.pendingExamAssessmentId = assessment.id;

  // Tanpa markup modal (mis. halaman lama), jangan sampai siswa terkunci.
  if (!els.preExamModal) {
    startExam(ctx, assessment.id);
    return;
  }

  ctx.preExamTrigger = trigger;
  ctx.micCheck?.reset();
  if (els.preExamTitle) els.preExamTitle.textContent = assessment.topic || "Penilaian";
  if (els.preExamMeta) els.preExamMeta.innerHTML = buildPreExamMeta(ctx, assessment);
  resetPreExamMicUi(ctx);

  const isOralExam = assessment.oralExamEnabled !== false;
  els.preExamMicSection?.classList.toggle("hidden", !isOralExam);
  if (els.preExamStart) {
    els.preExamStart.textContent = "Mulai ujian sekarang";
    els.preExamStart.disabled = isOralExam;
  }
  setPreExamNote(
    ctx,
    isOralExam
      ? "Tes mikrofon dulu agar jawaban lisan Anda terekam. Timer belum berjalan."
      : "Penilaian ini tidak memerlukan mikrofon. Timer mulai setelah Anda menekan tombol mulai.",
    false,
  );

  els.preExamModal.classList.remove("hidden");
  (isOralExam ? els.preExamMicTest : els.preExamStart)?.focus();
}

function closePreExamModal(ctx, { returnFocus = true } = {}) {
  const { els } = ctx;
  if (!els.preExamModal) return;
  els.preExamModal.classList.add("hidden");
  ctx.micCheck?.reset();
  ctx.pendingExamAssessmentId = null;
  if (returnFocus && ctx.preExamTrigger instanceof HTMLElement && document.contains(ctx.preExamTrigger)) {
    ctx.preExamTrigger.focus();
  }
  ctx.preExamTrigger = null;
}

function buildPreExamMeta(ctx, assessment) {
  const total = assessment.questions?.length || 0;
  const timeLimit = Number(assessment.timeLimit) || 0;
  const used = ctx.state.submissions.filter((submission) => submission.assessmentId === assessment.id).length;
  const maxAttempts = assessment.allowRetakes ? Infinity : Number(assessment.maxAttempts) || 1;
  const attempts = Number.isFinite(maxAttempts)
    ? `${Math.max(0, maxAttempts - used)} percobaan tersisa`
    : "Percobaan tak terbatas";

  return `
    <div class="pre-exam-topic">
      <strong>Topik:</strong> ${escapeHtml(assessment.topic || "-")}
    </div>
    ${assessment.outcomes ? `<div class="pre-exam-outcome"><strong>Kompetensi:</strong> ${escapeHtml(assessment.outcomes)}</div>` : ""}
    <div class="pre-exam-stats">
      ${[
        `📝 ${total} soal`,
        timeLimit > 0 ? `⏱ ${formatDuration(timeLimit)} / soal` : "⏱ Tanpa batas waktu",
        `🔄 ${attempts}`,
        `🎚 ${assessment.difficulty || "-"}`,
      ]
        .map((text) => `<span>${escapeHtml(text)}</span>`)
        .join("")}
    </div>
  `;
}

function resetPreExamMicUi(ctx) {
  const { els } = ctx;
  if (els.preExamMicTest) {
    els.preExamMicTest.disabled = false;
    els.preExamMicTest.textContent = "Tes mikrofon";
  }
  setPreExamMicStatus(ctx, "Mikrofon belum dites", "");
  if (els.preExamMicDiagnostics) {
    els.preExamMicDiagnostics.innerHTML = "";
    els.preExamMicDiagnostics.classList.add("hidden");
  }
}

function setPreExamMicStatus(ctx, text, variant) {
  const { els } = ctx;
  if (!els.preExamMicStatus) return;
  els.preExamMicStatus.textContent = text;
  els.preExamMicStatus.className = `mic-status${variant ? ` ${variant}` : ""}`;
}

function setPreExamNote(ctx, text, warn) {
  const { els } = ctx;
  if (!els.preExamStartNote) return;
  els.preExamStartNote.textContent = text;
  els.preExamStartNote.className = `pre-exam-note${warn ? " warn" : ""}`;
}

async function runPreExamMicTest(ctx) {
  const { els } = ctx;
  if (!ctx.micCheck || ctx.micCheck.isRunning()) return;

  if (els.preExamMicTest) els.preExamMicTest.disabled = true;
  if (els.preExamStart) els.preExamStart.disabled = true;
  if (els.preExamMicDiagnostics) els.preExamMicDiagnostics.classList.add("hidden");
  setPreExamMicStatus(ctx, "Menyiapkan mikrofon...", "");
  setPreExamNote(ctx, "Bicara dengan suara normal selama beberapa detik.", false);

  const result = await ctx.micCheck.run((secondsLeft) => {
    if (secondsLeft > 0) setPreExamMicStatus(ctx, `Bicara sekarang... ${secondsLeft}s`, "");
  });

  if (els.preExamMicTest) {
    els.preExamMicTest.disabled = false;
    els.preExamMicTest.textContent = "Tes ulang mikrofon";
  }
  // Setelah tes selesai siswa selalu boleh mulai: mikrofon gagal pun jawaban
  // masih bisa diketik, jadi jangan sampai ujian terkunci.
  if (els.preExamStart) els.preExamStart.disabled = false;
  renderPreExamMicResult(ctx, result);
}

function renderPreExamMicResult(ctx, result) {
  const { els } = ctx;
  const box = els.preExamMicDiagnostics;

  if (!result.ok) {
    setPreExamMicStatus(ctx, "✕ Mikrofon bermasalah", "error");
    if (box) {
      box.classList.remove("hidden", "ok");
      box.classList.add("error");
      box.innerHTML = `
        <strong>Mikrofon belum bisa dipakai.</strong>
        <p>${escapeHtml(result.message)}</p>
        ${buildMicHelp(result.name)}
      `;
    }
    if (els.preExamStart) els.preExamStart.textContent = "Mulai tanpa mikrofon";
    setPreExamNote(ctx, "Mikrofon gagal. Anda tetap bisa mulai dan mengetik jawaban di kolom transkripsi.", true);
    return;
  }

  if (!result.heard) {
    setPreExamMicStatus(ctx, "⚠ Suara tidak terdengar", "error");
    if (box) {
      box.classList.remove("hidden", "ok");
      box.classList.add("error");
      box.innerHTML = `
        <strong>Mikrofon terbaca, tetapi tidak ada suara masuk.</strong>
        <p>${escapeHtml(result.message)}</p>
        <ul>
          <li>Pastikan mikrofon tidak dalam kondisi mute (hardware maupun sistem).</li>
          <li>Pilih perangkat input yang benar di pengaturan suara.</li>
          <li>Dekatkan mikrofon lalu klik <b>Tes ulang mikrofon</b>.</li>
        </ul>
      `;
    }
    setPreExamNote(ctx, "Sebaiknya tes ulang dulu sebelum mulai agar jawaban lisan Anda terekam.", true);
    return;
  }

  setPreExamMicStatus(ctx, "✓ Mikrofon siap", "ok");
  if (box) {
    box.classList.remove("hidden", "error");
    box.classList.add("ok");
    box.innerHTML = `
      <strong>Mikrofon siap digunakan.</strong>
      <p>${escapeHtml(result.message)}</p>
      ${result.hasPlayback ? "<p>Putar rekaman di atas untuk memastikan suara Anda jelas.</p>" : ""}
    `;
  }
  setPreExamNote(ctx, "Mikrofon siap. Timer akan mulai begitu Anda menekan tombol mulai.", false);
}

async function startExamFromModal(ctx) {
  const assessmentId = ctx.pendingExamAssessmentId;
  if (!assessmentId || ctx.isStartingExam) return;
  ctx.isStartingExam = true;
  if (ctx.els.preExamStart) ctx.els.preExamStart.disabled = true;
  try {
    closePreExamModal(ctx, { returnFocus: false });
    await startExam(ctx, assessmentId);
  } finally {
    ctx.isStartingExam = false;
  }
}

/** Titik tunggal yang benar-benar memulai ujian: soal tampil dan timer berjalan. */
export async function startExam(ctx, assessmentId) {
  const { els } = ctx;
  ctx.recorder.stop();
  ctx.session.selectAssessment(assessmentId);
  resetProbingState(ctx);
  els.resultPanel.classList.add("hidden");
  renderStudentState(ctx);
  await startRecorderForCurrentAssessment(ctx);
  startQuestionTimer(ctx);
  ctx.questionStartTime = Date.now();

  // Warn before closing tab during active exam.
  window.addEventListener("beforeunload", beforeUnloadHandler);
}

/** Bersihkan status probing agar tidak bocor antar sesi/soal. */
function resetProbingState(ctx) {
  ctx.inProbing = false;
  ctx.probingPrompt = null;
}

/**
 * Lanjut setelah satu jawaban (utama atau probing) tersimpan: ke soal
 * berikutnya atau selesaikan bila ini soal terakhir.
 */
function advanceAfterAnswer(ctx) {
  const { els } = ctx;
  const assessment = ctx.session.getCurrentAssessment();
  const qi = ctx.session.currentQuestionIndex;
  const isLast = assessment && qi === assessment.questions.length - 1;
  if (isLast) {
    stopQuestionTimer(ctx);
    confirmAndFinishAssessment(ctx);
    return;
  }
  ctx.session.goNext();
  renderQuestion(els, assessment, ctx.session);
  startRecorderForCurrentAssessment(ctx);
  startQuestionTimer(ctx);
  ctx.questionStartTime = Date.now();
}

/**
 * Mulai probing untuk soal saat ini: bangkitkan pertanyaan lanjutan berbasis
 * jawaban siswa, tampilkan, lalu jalankan timer probing.
 */
async function startProbingForCurrentQuestion(ctx) {
  const { els } = ctx;
  const assessment = ctx.session.getCurrentAssessment();
  const qi = ctx.session.currentQuestionIndex;
  const q = assessment?.questions?.[qi];
  if (!q) return;
  const answer = ctx.session.currentAnswers[qi]?.text || "";

  ctx.inProbing = true;
  ctx.probingPrompt = null;
  ctx.probingRaw = "";
  if (els.questionProgress) {
    els.questionProgress.textContent = `Soal ${qi + 1} dari ${assessment.questions.length} — pertanyaan lanjutan`;
  }
  if (els.activeHint) {
    els.activeHint.textContent = "AI menyiapkan pertanyaan lanjutan berdasarkan jawaban Anda...";
    els.activeHint.classList.remove("hidden");
  }
  if (els.recordButton) els.recordButton.disabled = true;
  if (els.answerText) {
    els.answerText.readOnly = true;
    els.answerText.value = "";
  }
  setButtonLoading(els.saveAnswer, true, "Menyiapkan pertanyaan lanjutan...", "Simpan & lanjut");

  let probing;
  try {
    probing = await generateProbingFallback(ctx, assessment, q, answer);
  } catch (error) {
    console.error("Gagal menyiapkan probing:", error);
    probing = { question: "Jelaskan lebih lanjut alasan atau contoh yang mendukung jawaban Anda.", source: "fallback" };
  }

  ctx.probingPrompt = probing.question;
  ctx.probingSource = probing.source || "fallback";
  if (els.activeQuestion) els.activeQuestion.textContent = probing.question;
  if (els.activeHint) els.activeHint.textContent = "Jawab pertanyaan lanjutan ini, lalu simpan untuk melanjutkan.";
  if (els.answerText) {
    els.answerText.readOnly = false;
    els.answerText.value = "";
    els.answerText.focus();
  }
  if (els.recordButton) els.recordButton.disabled = false;
  setButtonLoading(els.saveAnswer, false, "", "Simpan & lanjut");
  startRecorderForCurrentAssessment(ctx);
  startQuestionTimer(ctx);
  ctx.questionStartTime = Date.now();
}

function buildMicHelp(name) {
  const label = name ? escapeHtml(name) : "mikrofon";
  return `<ul><li>Pastikan browser memiliki izin mengakses ${label}.</li><li>Pilih perangkat input yang benar di pengaturan sistem.</li><li>Jika memakai headset Bluetooth, pastikan perangkat sudah terhubung.</li></ul>`;
}

function renderMicDiagnostics(ctx, result) {
  const { els } = ctx;
  if (!els.micDiagnostics) return;
  els.micDiagnostics.classList.remove("hidden");
  els.micDiagnostics.innerHTML = `<div class="mic-diagnostic-row"><strong>${escapeHtml(result.name || "Mikrofon")}</strong><span>${escapeHtml(result.message || "-")}</span></div>`;
}

async function startRecorderForCurrentAssessment(ctx) {
  const assessment = ctx.session.getCurrentAssessment();
  if (!assessment) return;
  const oralExamEnabled = assessment.oralExamEnabled !== false;
  ctx.recorder.setEnabled(oralExamEnabled);
  if (oralExamEnabled) await ctx.recorder.start();
}

function startQuestionTimer(ctx) {
  stopQuestionTimer(ctx);
  const assessment = ctx.session.getCurrentAssessment();
  if (!assessment) return;
  const limit = Number(assessment.timeLimit) || 0;
  if (limit <= 0) return;
  ctx.currentQuestionTimeLeft = limit;
  updateTimerDisplay(ctx);
  ctx.questionTimerInterval = window.setInterval(() => {
    ctx.currentQuestionTimeLeft -= 1;
    updateTimerDisplay(ctx);
    if (ctx.currentQuestionTimeLeft <= 0) {
      stopQuestionTimer(ctx);
      showToast("Waktu soal habis. Jawaban saat ini akan disimpan dan dilanjutkan.", "error");
      saveCurrentAnswer(ctx).then(() => {
        const assessmentNow = ctx.session.getCurrentAssessment();
        const qi = ctx.session.currentQuestionIndex;
        if (assessmentNow && qi < assessmentNow.questions.length - 1) {
          ctx.session.goNext();
          renderQuestion(ctx.els, assessmentNow, ctx.session);
          startRecorderForCurrentAssessment(ctx);
          startQuestionTimer(ctx);
          ctx.questionStartTime = Date.now();
        } else {
          confirmAndFinishAssessment(ctx);
        }
      });
    }
  }, 1000);
}

function stopQuestionTimer(ctx) {
  if (ctx.questionTimerInterval) {
    window.clearInterval(ctx.questionTimerInterval);
    ctx.questionTimerInterval = null;
  }
}

function updateTimerDisplay(ctx) {
  if (ctx.els.questionTimer) {
    ctx.els.questionTimer.textContent = ctx.currentQuestionTimeLeft > 0 ? formatTime(ctx.currentQuestionTimeLeft) : "";
  }
}

async function saveCurrentAnswer(ctx) {
  const { els } = ctx;
  const assessment = ctx.session.getCurrentAssessment();
  const qi = ctx.session.currentQuestionIndex;
  if (!assessment || qi < 0) return;
  const text = els.answerText.value.trim();
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - ctx.questionStartTime) / 1000));
  ctx.session.saveAnswer(text, { elapsedSeconds });
  if (ctx.inProbing && ctx.probingPrompt) {
    ctx.session.currentAnswers[qi].probing = {
      question: ctx.probingPrompt,
      answer: text,
      source: ctx.probingSource || "fallback",
      done: true,
    };
  }
  setButtonLoading(els.saveAnswer, true, "Menyimpan...", "Simpan & lanjut");
  try {
    await saveSubmissionToDatabase(createSubmission(ctx));
  } finally {
    setButtonLoading(els.saveAnswer, false, "", "Simpan & lanjut");
  }
}

function confirmAndFinishAssessment(ctx) {
  showConfirmDialog(
    "Yakin ingin mengakhiri penilaian? Jawaban yang sudah disimpan akan dinilai oleh AI.",
    "Selesaikan Penilaian",
    async () => {
      await finishAssessment(ctx);
    }
  );
}

async function finishAssessment(ctx) {
  const { els } = ctx;
  stopQuestionTimer(ctx);
  ctx.recorder.stop();
  window.removeEventListener("beforeunload", beforeUnloadHandler);
  setButtonLoading(els.finishAssessment, true, "Menilai...", "Selesai");
  try {
    const submission = createSubmission(ctx);
    const aiResult = await evaluateSubmission(ctx, submission);
    if (aiResult) {
      showResult(els, aiResult, ctx.auth);
      renderStudentHistory(els, ctx.state.submissions, ctx.auth.user.name);
    }
  } finally {
    setButtonLoading(els.finishAssessment, false, "", "Selesai");
  }
}

async function evaluateSubmission(ctx, submission) {
  const { els } = ctx;
  try {
    const chunks = [];
    updateEvaluationProgress(els, 0);
    const result = await streamAssessmentAction({
      action: "evaluate",
      payload: submission,
      onChunk: (chunk) => {
        chunks.push(chunk);
        updateEvaluationProgress(els, Math.min(95, chunks.length * 8));
        renderEvaluationPreview(els, chunks.join(""));
      },
      onResult: (data) => {
        updateEvaluationProgress(els, 100);
        if (data?.submission) {
          ctx.state.submissions = ctx.state.submissions.map((item) => item.id === data.submission.id ? data.submission : item);
        }
      },
    });
    return result?.submission || null;
  } catch (error) {
    console.error("AI evaluation failed:", error);
    showToast(`AI evaluation gagal: ${error.message}`, "error");
    const fallback = evaluateFallbackAssessment(submission);
    ctx.state.submissions = ctx.state.submissions.map((item) => item.id === fallback.id ? fallback : item);
    return fallback;
  }
}

function beforeUnloadHandler(event) {
  event.preventDefault();
  event.returnValue = "";
}

function prettifyQuestionId(id) {
  return prettifyId(id);
}
