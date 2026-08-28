import {
  saveSubmissionToDatabase,
  streamAssessmentAction,
} from "./api.js";
import { createSubmission } from "./assessment-factory.js";
import { setButtonLoading } from "./dom.js";
import { evaluateFallbackAssessment, generateProbingFallback } from "./fallback-assessment.js";
import { createMicCheck } from "./mic-check.js";
import { formatDuration, renderMonitoring, renderQuestion, renderStudentHistory, showResult } from "./render.js";
import { showToast, showConfirmDialog } from "./toast.js";
import { escapeHtml, formatTime, prettifyId } from "./utils.js";
import { isAssessmentLocked, renderCurrentState } from "./app-context.js";

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
      await renderCurrentState(ctx);
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
  await renderCurrentState(ctx);
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
    probing = await generateProbingForAnswer(ctx, assessment, q, answer);
  } catch (error) {
    ctx.inProbing = false;
    showToast("Gagal membuat pertanyaan lanjutan, lanjut ke soal berikutnya.", "error");
    ctx.session.currentAnswers[qi].probing = { done: true };
    setButtonLoading(els.saveAnswer, false, "", "Simpan & lanjut");
    advanceAfterAnswer(ctx);
    return;
  } finally {
    setButtonLoading(els.saveAnswer, false, "", "Simpan & lanjut");
  }

  ctx.probingPrompt = probing.prompt;
  ctx.session.currentAnswers[qi].probing = {
    prompt: probing.prompt,
    answer: "",
    audio: null,
    duration: 0,
    done: false,
  };
  renderProbing(ctx, probing);
  startQuestionTimer(ctx);
  ctx.questionStartTime = Date.now();
}

/** Bangkitkan pertanyaan probing via AI, dengan fallback deterministik. */
async function generateProbingForAnswer(ctx, assessment, question, answer) {
  const payload = {
    prompt: question.prompt,
    focus: question.focus || assessment.topic,
    outcomes: question.outcome || assessment.outcomes,
    answer,
  };
  const fallback = () =>
    generateProbingFallback({
      prompt: question.prompt,
      answer,
      focus: question.focus || assessment.topic,
      topic: assessment.topic,
    });

  let probing = null;
  try {
    probing = await withTimeout(
      new Promise((resolve, reject) => {
        streamAssessmentAction({
          action: "generate-probing",
          payload,
          onResult: (data) => resolve(data?.probing || null),
          onError: (message) => reject(new Error(message)),
        }).catch(reject);
      }),
      PROBING_TIMEOUT_MS,
    );
  } catch {
    probing = null;
  }
  if (probing && String(probing.prompt || "").trim()) return probing;
  return fallback();
}

/** Alasan utama AI belum menghasilkan probing dalam waktu wajar -> fallback deterministik. */
const PROBING_TIMEOUT_MS = 15000;

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Tampilkan pertanyaan probing di panel ujian. */
function renderProbing(ctx, probing) {
  const { els } = ctx;
  if (els.activeQuestion) els.activeQuestion.textContent = probing?.prompt || "Pertanyaan lanjutan.";
  if (els.activeHint) {
    els.activeHint.textContent = "Jawab pertanyaan lanjutan ini. Timer berjalan seperti soal sebelumnya.";
    els.activeHint.classList.remove("hidden");
  }
  if (els.recordButton) els.recordButton.disabled = false;
  if (els.answerText) {
    els.answerText.readOnly = false;
    els.answerText.value = "";
  }
  if (els.saveAnswer) els.saveAnswer.textContent = "Simpan & lanjut";
}

function beforeUnloadHandler(e) {
  e.preventDefault();
  e.returnValue = "";
}

function clearBeforeUnload() {
  window.removeEventListener("beforeunload", beforeUnloadHandler);
}

export async function saveCurrentAnswer(ctx) {
  const audio = await ctx.recorder.getAudioBase64();
  const elapsed = Math.round((Date.now() - ctx.questionStartTime) / 1000);
  if (ctx.inProbing) {
    const qi = ctx.session.currentQuestionIndex;
    const probing = ctx.session.currentAnswers[qi].probing ||= { done: false };
    probing.answer = (ctx.els.answerText.value || "").trim();
    if (audio) probing.audio = audio;
    probing.duration = (probing.duration || 0) + elapsed;
    probing.done = true;
  } else {
    ctx.session.saveAnswer(ctx.els.answerText.value, audio, elapsed);
  }
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

export async function confirmAndFinishAssessment(ctx) {
  const assessment = ctx.session.getCurrentAssessment();
  if (!assessment) return;

  const unanswered = getUnansweredCount(ctx);
  const total = assessment.questions.length;

  await saveCurrentAnswer(ctx);
  const unansweredAfterSave = getUnansweredCount(ctx);

  let message;
  if (unansweredAfterSave > 0) {
    message = unansweredAfterSave === total
      ? "Belum ada satu pun soal yang dijawab. Anda akan mengumpulkan penilaian tanpa jawaban."
      : `${unansweredAfterSave} dari ${total} soal belum dijawab. Soal kosong akan dinilai 0.`;
  } else {
    message = `Semua ${total} soal sudah dijawab. Yakin ingin menyelesaikan dan mengumpulkan penilaian?`;
  }

  const proceed = await showConfirmDialog(message, 'Selesaikan Penilaian');
  if (!proceed) return;

  handleFinishAssessment(ctx);
}

export async function handleFinishAssessment(ctx) {
  const { els } = ctx;
  if (ctx.isEvaluating) return;
  clearBeforeUnload();
  const assessment = ctx.session.getCurrentAssessment();
  if (!assessment) return;

  ctx.isEvaluating = true;
  els.evaluationLoadingModal?.classList.remove("hidden");
  if (els.evaluationStreamContent) els.evaluationStreamContent.textContent = "";
  setButtonLoading(els.finishAssessment, true, "Menilai dengan AI...", "Selesaikan penilaian");

  try {
    await saveCurrentAnswer(ctx);
    const studentName = ctx.auth.user.role === "student"
      ? ctx.auth.user.name
      : els.studentName.value.trim() || "Siswa tanpa nama";
    const submission = await evaluateWithFallback(ctx, assessment, studentName);
    // Skip DB persistence for tryout/practice assessments
    if (!assessment.isTryout) {
      await saveSubmissionToDatabase(submission);
      ctx.state.submissions.push(submission);
    } else {
      submission.isTryout = true;
      showToast("Hasil tryout ditampilkan di sini (tidak disimpan ke database)", "info");
    }
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
  const answers = ctx.session.currentAnswers;
  try {
    const textAnswers = answers.map((a) => combineAnswerWithProbing(a).text);
    const safeAssessment = sanitizeAssessmentForEvaluation(assessment);

    const data = await streamAssessmentAction({
      action: "evaluate",
      payload: { assessment: safeAssessment, answers: textAnswers, studentName },
      onChunk: (text) => {
        // Tampilkan status/progress live dari server (streaming partial):
        // ganti teks tahap terkini alih-alih menumpuk, supaya siswa melihat
        // kemajuan evaluasi secara real-time, bukan modal kosong.
        if (ctx.els.evaluationStreamContent) {
          ctx.els.evaluationStreamContent.textContent = text || "";
          ctx.els.evaluationStreamContent.scrollTop = ctx.els.evaluationStreamContent.scrollHeight;
        }
      },
    });

    const questionScoresWithMetadata = data.evaluation.questionScores.map((qs, idx) => ({
      ...qs,
      audio: answers[idx]?.audio || null,
      duration: answers[idx]?.duration || 0,
      probing: answers[idx]?.probing || null,
    }));

    const evaluation = data.evaluation;
    return createSubmission({
      assessment,
      studentName,
      finalScore: evaluation.finalScore,
      questionScores: questionScoresWithMetadata,
      feedback: evaluation.feedback,
      status: evaluation.requiresHumanReview ? "NEEDS_REVIEW" : "EVALUATED",
      verification: evaluation.verification || null,
      criteria: evaluation.criteria || [],
      evaluationRunId: evaluation.evaluationRunId || null,
      evaluationId: evaluation.evaluationId || null,
      evaluationSource: "harness",
      insight: buildHarnessInsight(evaluation),
    });
  } catch (error) {
    showToast("AI sedang tidak dapat diakses, penilaian memakai evaluasi lokal yang tetap valid.", "info");
    const combinedAnswers = answers.map((a) => combineAnswerWithProbing(a));
    const fallback = evaluateFallbackAssessment(assessment, combinedAnswers, studentName, createSubmission);
    return {
      ...fallback,
      evaluationSource: "fallback",
      verification: null,
      criteria: [],
    };
  }
}

/**
 * Gabungkan jawaban utama dengan jawaban probing (bila ada) menjadi satu teks
 * jawaban per soal, sehingga evaluasi berbasis rubrik turut menilai bukti dari
 * jawaban lanjutan siswa. Metadata probing tetap dipertahankan terpisah untuk
 * traceability.
 */
function combineAnswerWithProbing(answerObj) {
  const base = String(answerObj?.text || "").trim();
  const probing = answerObj?.probing;
  const hasProbing =
    probing && probing.done && String(probing.answer || "").trim().length > 0;
  if (!hasProbing) return { ...answerObj, text: base };
  const probingText = String(probing.answer).trim();
  const combined = base
    ? `${base}\n\n[Jawaban pertanyaan lanjutan]\n${probingText}`
    : probingText;
  return { ...answerObj, text: combined };
}

function buildHarnessInsight(evaluation) {
  const criteria = Array.isArray(evaluation.criteria) ? evaluation.criteria : [];
  if (!criteria.length) return "";
  const weakest = criteria
    .filter((c) => Number.isFinite(Number(c.score)))
    .sort((a, b) => Number(a.score) - Number(b.score))[0];
  const strongest = criteria
    .filter((c) => Number.isFinite(Number(c.score)))
    .sort((a, b) => Number(b.score) - Number(a.score))[0];
  const parts = [];
  if (strongest) parts.push(`Kekuatan utama pada ${strongest.name || prettifyId(strongest.criterionId) || "kriteria terkuat"}.`);
  if (weakest) parts.push(`Area yang perlu diperkuat: ${weakest.name || prettifyId(weakest.criterionId) || "kriteria terlemah"}.`);
  return parts.join(" ").trim();
}

function sanitizeAssessmentForEvaluation(assessment) {
  if (!assessment || !Array.isArray(assessment.questions)) return assessment;
  return {
    ...assessment,
    questions: assessment.questions.map((question) => ({
      prompt: question?.prompt || "",
      focus: question?.focus || "",
    })),
  };
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

  const qi = ctx.session.currentQuestionIndex;
  const target = ctx.inProbing ? ctx.session.currentAnswers[qi]?.probing : ctx.session.currentAnswers[qi];
  if (!target) return;

  if (target.timeLeft === undefined) {
    target.timeLeft = assessment.timeLimit;
  }

  ctx.currentQuestionTimeLeft = target.timeLeft;

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
    target.timeLeft = ctx.currentQuestionTimeLeft;

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
  const qi = ctx.session.currentQuestionIndex;
  const q = assessment.questions[qi];

  if (ctx.inProbing) {
    // Waktu probing habis -> lanjut ke soal berikutnya.
    ctx.inProbing = false;
    ctx.probingPrompt = null;
    advanceAfterAnswer(ctx);
    return;
  }

  // Waktu soal utama habis; bila soal ini mengaktifkan probing yang belum
  // dilakukan, mulai probing (alur yang sama dengan klik "Simpan & lanjut").
  if (q?.probing && !ctx.session.currentAnswers[qi]?.probing?.done) {
    await startProbingForCurrentQuestion(ctx);
    return;
  }

  const isLastQuestion = qi === assessment.questions.length - 1;
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