import { average, compactText, escapeHtml } from "./utils.js";
import { showEmpty } from "./dom.js";

const EMPTY_ASSESSMENTS = "Buat penilaian pertama agar soal dapat ditinjau dan dibagikan ke kelas.";
const EMPTY_STUDENT = "Guru belum menugaskan penilaian untuk kelas ini.";
const EMPTY_SUBMISSIONS = "Hasil akan muncul setelah siswa menyelesaikan penilaian.";
const EMPTY_TRENDS = "Belum ada tren skor.";

export function renderApp(els, state, session) {
  renderAssessments(els, state);
  renderStudentArea(els, state, session);
  renderMonitoring(els, state);
}

export function renderAssessments(els, state) {
  els.assessmentCount.textContent = state.assessments.length;
  if (!state.assessments.length) {
    showEmpty(els.assessmentList, "list-stack empty-state", EMPTY_ASSESSMENTS);
    return;
  }

  els.assessmentList.className = "list-stack";
  els.assessmentList.innerHTML = state.assessments.map(renderAssessmentItem).join("");
}

export function renderStudentArea(els, state, session) {
  const selectedClassId = els.studentClassFilter?.value;
  let visibleAssessments = state.assessments.filter(a => a.status !== "closed");
  if (selectedClassId) {
    visibleAssessments = visibleAssessments.filter(a => a.classId === selectedClassId);
  }

  if (!visibleAssessments.length) {
    els.studentEmpty?.classList.remove("hidden");
    if (els.studentAssessmentGrid) els.studentAssessmentGrid.innerHTML = "";
  } else {
    els.studentEmpty?.classList.add("hidden");
    if (els.studentAssessmentGrid) {
      els.studentAssessmentGrid.innerHTML = visibleAssessments.map(assessment => {
        const studentSubmissions = state.submissions.filter(s => s.assessmentId === assessment.id);
        const hasSubmitted = studentSubmissions.length > 0;
        let buttonText = 'Mulai Kerjakan';
        let buttonClass = 'primary-button start-assessment-btn';
        
        const isLocked = hasSubmitted && !assessment.allowRetakes;
        const latestSubmission = hasSubmitted
          ? studentSubmissions.slice().sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0]
          : null;

        // Attempts remaining
        let attemptsText = '1 percobaan';
        if (assessment.allowRetakes) {
          const used = studentSubmissions.length;
          attemptsText = used > 0 ? `Sisa ${Math.max(0, 3 - used)} percobaan` : '3 percobaan';
        } else if (hasSubmitted) {
          attemptsText = 'Percobaan habis';
        }

        // Time limit
        const timeLimit = Number(assessment.timeLimit) || 0;
        const timeText = timeLimit > 0 ? `⏱ ${formatDuration(timeLimit)} / soal` : '⏱ Tanpa batas waktu';

        // Status
        let statusHtml = '';
        if (hasSubmitted) {
          const statusClass = isLocked ? 'badge-closed' : 'badge-published';
          const statusLabel = isLocked ? 'Selesai' : 'Dikerjakan';
          statusHtml = `<span class="tag ${statusClass}" style="width: fit-content;">${statusLabel}</span>`;
        } else {
          statusHtml = `<span class="tag badge-published" style="width: fit-content;">Belum dikerjakan</span>`;
        }

        const scoreHtml = latestSubmission
          ? `<p style="margin: 0; font-size: 0.95rem; font-weight: 600; color: var(--emerald);">Nilai terakhir: ${latestSubmission.finalScore}</p>`
          : '';

        if (hasSubmitted && assessment.allowRetakes) {
          buttonText = 'Kerjakan Ulang';
          buttonClass = 'secondary-button start-assessment-btn';
        } else if (hasSubmitted && !assessment.allowRetakes) {
          buttonText = 'Sudah Dikumpulkan';
          buttonClass = 'secondary-button';
        }

        return `
          <div class="assessment-card" data-id="${assessment.id}">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
              <h4>${escapeHtml(assessment.topic)}</h4>
              ${statusHtml}
            </div>
            <span class="tag badge-published" style="width: fit-content;">${escapeHtml(assessment.difficulty)}</span>
            <div class="assessment-meta">
              <span>📝 ${assessment.questions.length} soal</span>
              <span>${timeText}</span>
              <span>🔄 ${attemptsText}</span>
            </div>
            ${scoreHtml}
            <button type="button" class="${buttonClass}" data-id="${assessment.id}" style="margin-top: auto;" ${isLocked ? "disabled" : ""}>${buttonText}</button>
          </div>
        `;
      }).join("");
    }
  }

  if (session.currentAssessmentId) {
    els.studentDashboard?.classList.add("hidden");
    els.studentWorkspace?.classList.remove("hidden");
    renderQuestion(els, session.getCurrentAssessment(), session);
  } else {
    els.studentDashboard?.classList.remove("hidden");
    els.studentWorkspace?.classList.add("hidden");
  }
}

export function renderQuestion(els, assessment, session) {
  if (!assessment) return;
  const question = assessment.questions[session.currentQuestionIndex];

  els.questionProgress.textContent = `Soal ${session.currentQuestionIndex + 1} dari ${assessment.questions.length}`;
  els.activeDifficulty.textContent = assessment.difficulty;
  els.activeQuestion.textContent = question.prompt;
  els.activeHint.textContent = "";
  els.activeHint.classList.add("hidden");

  if (els.activeOutcome) {
    els.activeOutcome.textContent = question.outcome || assessment.outcomes || "";
    els.activeOutcome.classList.toggle("hidden", !els.activeOutcome.textContent);
  }
  if (els.activeRubric) {
    els.activeRubric.textContent = question.rubric || assessment.rubric || "";
    els.activeRubric.classList.toggle("hidden", !els.activeRubric.textContent);
  }
  
  const isOralExam = assessment.oralExamEnabled !== false;
  if (!isOralExam) {
    els.answerText.placeholder = "Tulis jawaban Anda di sini.";
    els.answerText.readOnly = false;
    els.recordButton.disabled = true;
    els.recorderPanel?.classList.add("hidden");
    if (els.recordInstructions) {
      els.recordInstructions.textContent = "Mode tulisan aktif. Jawab setiap soal dengan mengetik jawaban Anda.";
    }
  } else if (assessment.disableManualTyping) {
    els.answerText.placeholder = "Jawaban manual dimatikan untuk penilaian ini. Silakan menjawab menggunakan rekaman suara.";
    els.answerText.readOnly = true;
    els.recordButton.disabled = false;
    els.recorderPanel?.classList.remove("hidden");
    if (els.recordInstructions) {
      els.recordInstructions.textContent = "Gunakan Chrome/Edge di http://127.0.0.1:4173 dan izinkan mikrofon. Siswa wajib menjawab secara lisan (pengetikan manual dinonaktifkan).";
    }
  } else {
    els.answerText.placeholder = "Transkripsi otomatis atau jawaban manual siswa akan muncul di sini";
    els.answerText.readOnly = false;
    els.recordButton.disabled = false;
    els.recorderPanel?.classList.remove("hidden");
    if (els.recordInstructions) {
      els.recordInstructions.textContent = "Gunakan Chrome/Edge di http://127.0.0.1:4173 dan izinkan mikrofon. Jika transkripsi otomatis tidak tersedia, ketik hasil rekaman manual.";
    }
  }

  els.answerText.value = session.currentAnswers[session.currentQuestionIndex]?.text || "";
  els.prevQuestion.disabled = session.currentQuestionIndex === 0;
  renderAnswerMap(els, assessment, session.currentAnswers);
}

export function renderMonitoring(els, state) {
  const selectedClassId = els.monitorClassFilter?.value;
  const rangeDays = Number(els.monitorRangeFilter?.value) || 0;
  let visibleSubmissions = state.submissions;
  if (selectedClassId) {
    visibleSubmissions = state.submissions.filter(s => s.classId === selectedClassId);
  }
  if (rangeDays > 0) {
    const cutoff = Date.now() - rangeDays * 24 * 60 * 60 * 1000;
    visibleSubmissions = visibleSubmissions.filter(s => new Date(s.submittedAt).getTime() >= cutoff);
  }

  els.submissionCount.textContent = visibleSubmissions.length;

  if (els.downloadClassCsvBtn) {
    els.downloadClassCsvBtn.style.display = selectedClassId ? "inline-flex" : "none";
  }

  if (!visibleSubmissions.length) {
    els.classAverage.textContent = "0";
    els.classAverage.style.setProperty('--score', '0');
    if (els.trendAssessmentCount) els.trendAssessmentCount.textContent = "0 penilaian";
    showEmpty(els.trendList, "trend-list empty-state", EMPTY_TRENDS);
    els.submissionList.className = "";
    els.submissionList.innerHTML = `<tr><td colspan="5" class="empty-state">${EMPTY_SUBMISSIONS}</td></tr>`;
    return;
  }

  const avg = average(visibleSubmissions, (submission) => submission.finalScore);
  els.classAverage.textContent = avg;
  els.classAverage.style.setProperty('--score', avg);
  renderTrend(els, visibleSubmissions);
  renderSubmissions(els, visibleSubmissions);
}

export function showResult(els, submission, auth = null) {
  els.resultPanel._returnFocus = document.activeElement;
  els.resultPanel.classList.remove("hidden");
  els.resultPanel.dataset.submissionId = submission.id; // Store ID for override
  const summary = buildResultSummary(submission);
  els.resultPanel.innerHTML = `
    <div class="result-modal-content">
      <button class="result-close-btn close-result-btn" type="button" aria-label="Tutup hasil penilaian">&times;</button>
      <div class="result-header">
        <div style="flex: 1; min-width: 0;">
          <h3 style="margin-right: 40px;">Hasil penilaian: ${escapeHtml(submission.assessmentTitle)}</h3>
          <div class="rich-text">${formatRichText(submission.feedback)}</div>
        </div>
        <div class="score-badge">${submission.finalScore}</div>
      </div>

      <div class="result-summary">
        <div class="summary-score">
          <span class="summary-score-label">Skor akhir</span>
          <strong>${submission.finalScore}</strong>
          <span class="summary-score-sub">dari 100</span>
        </div>
        <div class="summary-columns">
          <div class="summary-col summary-strengths">
            <h4>💪 Kekuatan</h4>
            ${summary.strengths.length
              ? `<ul>${summary.strengths.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>`
              : `<p class="summary-empty">Belum ada catatan kekuatan.</p>`}
          </div>
          <div class="summary-col summary-gaps">
            <h4>🎯 Fokus perbaikan</h4>
            ${summary.gaps.length
              ? `<ul>${summary.gaps.map((g) => `<li>${escapeHtml(g)}</li>`).join("")}</ul>`
              : `<p class="summary-empty">Tidak ada catatan perbaikan.</p>`}
          </div>
        </div>
      </div>

      <div class="result-details">
        <button type="button" class="result-details-toggle" aria-expanded="false">
          <span>Detail per soal</span>
          <span class="result-details-caret">▾</span>
        </button>
        <div class="result-details-body hidden">
          <div class="feedback-grid">
            ${submission.questionScores.map((item, index) => renderFeedbackCard(item, index, auth)).join("")}
          </div>
        </div>
      </div>

      <div class="result-footer">
        <button class="primary-button close-result-btn" type="button">Tutup hasil</button>
      </div>
    </div>
  `;
  const toggle = els.resultPanel.querySelector(".result-details-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const body = els.resultPanel.querySelector(".result-details-body");
      const expanded = body.classList.toggle("hidden");
      toggle.setAttribute("aria-expanded", String(!expanded));
      toggle.querySelector(".result-details-caret").textContent = expanded ? "▸" : "▾";
    });
  }
  requestAnimationFrame(() => els.resultPanel.querySelector(".result-close-btn")?.focus());
}

function buildResultSummary(submission) {
  const strengths = [];
  const gaps = [];
  (submission.questionScores || []).forEach((item) => {
    (item.strengths || []).forEach((s) => strengths.push(s));
    (item.gaps || []).forEach((g) => gaps.push(g));
  });
  return {
    strengths: [...new Set(strengths)].slice(0, 2),
    gaps: [...new Set(gaps)].slice(0, 2),
  };
}

function renderAssessmentItem(assessment) {
  const isOralExam = assessment.oralExamEnabled !== false;
  const isClosed = assessment.status === "closed";
  const statusBadge = isClosed
    ? `<span class="tag badge-closed" style="padding: 2px 6px; font-size: 0.65rem;">Akses ditutup</span>`
    : `<span class="tag badge-published" style="padding: 2px 6px; font-size: 0.65rem;">${isOralExam ? "Lisan" : "Tulisan"}</span>`;

  return `
    <article class="assessment-item" data-id="${assessment.id}">
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
          <strong style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(assessment.topic)}</strong>
          ${statusBadge}
        </div>
        <p>${escapeHtml(compactText(assessment.outcomes))}</p>
        <div class="item-actions">
          <button type="button" class="action-button edit-assessment">Edit Soal</button>
          <button type="button" class="action-button download-grades-assessment">Download Nilai</button>
          <button type="button" class="action-button ${isClosed ? "reopen-assessment" : "close-assessment"}">${isClosed ? "Buka akses siswa" : "Tutup akses siswa"}</button>
          <div class="more-menu">
            <button type="button" class="action-button more-menu-trigger" aria-haspopup="true" aria-expanded="false" aria-label="Menu lainnya">⋯</button>
            <div class="more-menu-dropdown hidden">
              <button type="button" class="more-menu-item danger-button delete-assessment">Hapus penilaian</button>
            </div>
          </div>
        </div>
      </div>
      <span>${assessment.questions.length} soal</span>
    </article>
  `;
}

function renderAnswerMap(els, assessment, answers) {
  els.answerMap.innerHTML = assessment.questions
    .map((_, index) => {
      const answer = answers[index];
      const hasText = (answer?.text || "").trim().length > 0;
      const hasAudio = Boolean(answer?.audio);
      const done = hasText || hasAudio;
      const cls = done ? "done" : "unanswered";
      const title = done ? `Soal ${index + 1} sudah dijawab` : `Soal ${index + 1} belum dijawab`;
      return `<div class="answer-dot ${cls}" title="${title}" aria-label="${title}">${index + 1}</div>`;
    })
    .join("");
}

function renderTrend(els, submissions) {
  const trends = buildTrends(submissions);
  const assessmentCount = new Set(submissions.map((s) => s.assessmentId)).size;
  if (els.trendAssessmentCount) {
    els.trendAssessmentCount.textContent = `${assessmentCount} penilaian`;
  }

  els.trendList.className = trends.length ? "trend-list" : "trend-list empty-state";
  els.trendList.innerHTML = trends.length
    ? trends.map(renderTrendItem).join("")
    : EMPTY_TRENDS;
}

function renderSubmissions(els, submissions) {
  els.submissionList.className = "";
  els.submissionList.innerHTML = submissions.slice().reverse().map(renderSubmissionItem).join("");
}

function renderSubmissionItem(submission) {
  const date = submission.submittedAt ? new Date(submission.submittedAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : "-";
  return `
    <tr class="submission-row" data-id="${submission.id}">
      <td data-label="Siswa"><strong>${escapeHtml(submission.studentName)}</strong></td>
      <td data-label="Topik">${escapeHtml(submission.assessmentTitle)}</td>
      <td data-label="Tanggal">${date}</td>
      <td data-label="Skor AI"><span class="metric-pill" style="padding: 4px 12px;">${submission.finalScore}</span></td>
      <td data-label="Aksi">
        <button type="button" class="secondary-button view-submission-btn" style="min-height: 36px; font-size: 0.9rem;">Lihat Detail</button>
      </td>
    </tr>
  `;
}

function renderTrendItem(trend) {
  const deltaLabel = `${trend.delta >= 0 ? "+" : ""}${trend.delta}`;
  const deltaClass = trend.delta > 0 ? "trend-up" : trend.delta < 0 ? "trend-down" : "trend-flat";
  const history = trend.history.slice(-5).map((h) => `
    <span class="trend-point" title="${escapeHtml(h.date)}: ${h.score}">
      <span class="trend-point-bar" style="height: ${Math.max(4, h.score)}%"></span>
      <span class="trend-point-score">${h.score}</span>
    </span>
  `).join("");
  return `
    <div class="trend-item">
      <header>
        <strong>${escapeHtml(trend.studentName)}</strong>
        <span class="trend-delta ${deltaClass}">${trend.latest} (${deltaLabel})</span>
      </header>
      <div class="trend-track"><div class="trend-fill" style="width: ${trend.latest}%"></div></div>
      ${trend.history.length > 1 ? `<div class="trend-history">${history}</div>` : ""}
    </div>
  `;
}

function formatDuration(seconds) {
  if (!seconds) return "0 detik";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) {
    return `${m}m ${s}s`;
  }
  return `${s} detik`;
}

function renderFeedbackCard(item, index, auth) {
  const audioHtml = item.audio ? `<div style="margin-top: 12px; margin-bottom: 12px;"><audio controls src="${escapeHtml(item.audio)}" style="width: 100%; height: 36px;"></audio></div>` : '';
  
  const isTeacher = auth && auth.user && auth.user.role === 'teacher';
  const isStudent = auth && auth.user && auth.user.role === 'student';
  const durationText = item.duration !== undefined ? ` | ⏱️ ${formatDuration(item.duration)}` : '';

  // Complaint UI
  const complaint = item.complaint;
  let complaintHtml = "";
  if (complaint) {
    const statusLabel = complaint.status === "resolved" ? "Selesai" : "Menunggu";
    const statusClass = complaint.status === "resolved" ? "complaint-resolved" : "complaint-pending";
    complaintHtml = `
      <div class="complaint-box ${statusClass}">
        <strong>📩 Komplain siswa:</strong>
        <p>${escapeHtml(complaint.reason)}</p>
        ${complaint.status === "resolved" && complaint.response
          ? `<p class="complaint-response"><b>Respon guru:</b> ${escapeHtml(complaint.response)}</p>`
          : ""}
        <span class="tag">Status: ${statusLabel}</span>
      </div>
    `;
  }

  const complaintBtn = isStudent && !complaint
    ? `<button type="button" class="action-button complaint-btn" data-index="${index}">Komplain</button>`
    : "";

  // Teacher can respond to a pending complaint.
  const respondBtn = isTeacher && complaint && complaint.status === "pending"
    ? `<button type="button" class="action-button respond-complaint-btn" data-index="${index}">Respon Komplain</button>`
    : "";

  return `
    <article class="feedback-card" data-index="${index}">
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <strong>Soal ${index + 1} - Skor <span class="qs-score">${item.score}</span>${durationText}</strong>
        <div style="display: flex; gap: 8px;">
          ${complaintBtn}
          ${respondBtn}
          <button type="button" class="action-button edit-override-btn ${isTeacher ? '' : 'hidden'}" data-index="${index}">Koreksi</button>
        </div>
      </div>
      <div class="rich-text">${formatRichText(item.question)}</div>
      ${audioHtml}
      <p><b>Jawaban:</b> <i>"${escapeHtml(item.answer || (item.audio ? 'Hanya audio' : 'Tidak ada jawaban'))}"</i></p>
      <p><b>Kelebihan:</b> <span class="qs-strengths rich-text">${formatRichText(item.strengths?.join(" ") || "")}</span></p>
      <p><b>Masih kurang:</b> <span class="qs-gaps rich-text">${formatRichText(item.gaps?.join(" ") || "")}</span></p>
      ${complaintHtml}
      <div class="tag-row">
        ${(item.matched || []).slice(0, 5).map((keyword) => `<span class="tag">${escapeHtml(keyword)}</span>`).join("")}
      </div>
    </article>
  `;
}

function formatRichText(text) {
  if (!text) return "";
  const escaped = escapeHtml(text);
  const lines = escaped.split(/\r?\n/);
  const html = [];
  let inList = null;

  const closeList = () => {
    if (inList) {
      html.push(`</${inList}>`);
      inList = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }

    // Headings (## / ### / #)
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = Math.min(heading[1].length, 6);
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    // Unordered list
    const ulItem = line.match(/^[-*•]\s+(.*)$/);
    if (ulItem) {
      if (inList !== "ul") {
        closeList();
        html.push("<ul>");
        inList = "ul";
      }
      html.push(`<li>${inlineMarkdown(ulItem[1])}</li>`);
      continue;
    }

    // Ordered list
    const olItem = line.match(/^\d+[.)]\s+(.*)$/);
    if (olItem) {
      if (inList !== "ol") {
        closeList();
        html.push("<ol>");
        inList = "ol";
      }
      html.push(`<li>${inlineMarkdown(olItem[1])}</li>`);
      continue;
    }

    // Blockquote
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      closeList();
      html.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      closeList();
      html.push("<hr>");
      continue;
    }

    // Regular paragraph
    closeList();
    html.push(`<p>${inlineMarkdown(line)}</p>`);
  }

  closeList();
  return html.join("");
}

function inlineMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function buildTrends(submissions) {
  const latestByStudent = new Map();
  submissions.forEach((submission) => {
    const list = latestByStudent.get(submission.studentName) || [];
    list.push(submission);
    latestByStudent.set(submission.studentName, list);
  });

  return [...latestByStudent.entries()]
    .map(([studentName, studentSubmissions]) => {
      const sorted = studentSubmissions
        .slice()
        .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
      const latest = sorted.at(-1).finalScore;
      const previous = sorted.length > 1 ? sorted.at(-2).finalScore : latest;
      const history = sorted.map((s) => ({
        score: s.finalScore,
        date: new Date(s.submittedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      }));
      return { studentName, latest, delta: latest - previous, history };
    })
    .sort((a, b) => b.latest - a.latest);
}

export function renderStudentHistory(els, submissions, currentStudentName) {
  const studentSubmissions = submissions.filter(s => s.studentName === currentStudentName);
  
  if (!studentSubmissions.length) {
    els.studentHistoryList.innerHTML = '<tr><td colspan="4" class="empty-state">Belum ada riwayat penilaian.</td></tr>';
    return;
  }
  
  els.studentHistoryList.innerHTML = studentSubmissions.slice().reverse().map(sub => {
    const date = sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : "-";
    return `
      <tr class="submission-row" data-id="${sub.id}">
        <td data-label="Topik"><strong>${escapeHtml(sub.assessmentTitle)}</strong></td>
        <td data-label="Tanggal">${date}</td>
        <td data-label="Skor"><span class="metric-pill" style="padding: 4px 12px;">${sub.finalScore}</span></td>
        <td data-label="Aksi">
          <button type="button" class="secondary-button view-submission-btn" style="min-height: 36px; font-size: 0.9rem;">Lihat Hasil</button>
        </td>
      </tr>
    `;
  }).join('');
}

export function renderObservability(els, data) {
  const metrics = data?.metrics || {};
  const system = data?.system || {};
  const logs = Array.isArray(data?.logs) ? data.logs : [];

  // 1. Metric Cards
  if (els.telemetryTotalCalls) els.telemetryTotalCalls.textContent = metrics.totalCalls ?? 0;
  if (els.telemetryErrorRate) els.telemetryErrorRate.textContent = `Error Rate: ${metrics.errorRate ?? 0}%`;
  if (els.telemetryLatency) els.telemetryLatency.textContent = `${metrics.avgLatencyMs ?? 0} ms`;
  if (els.telemetryTokens) els.telemetryTokens.textContent = (metrics.totalTokens ?? 0).toLocaleString("id-ID");
  if (els.telemetryTokenBreakdown) {
    els.telemetryTokenBreakdown.textContent = `Prompt: ${(metrics.promptTokens ?? 0).toLocaleString("id-ID")} | Comp: ${(metrics.completionTokens ?? 0).toLocaleString("id-ID")}`;
  }
  if (els.telemetryCost) els.telemetryCost.textContent = `$${(metrics.actualCostUSD ?? 0).toFixed(5)}`;
  if (els.telemetryCacheEfficiency) els.telemetryCacheEfficiency.textContent = `${metrics.cacheEfficiencyPercent ?? 0}%`;
  if (els.telemetryCacheSavings) {
    els.telemetryCacheSavings.textContent = `Saved: ${(metrics.cacheSavingsTokens ?? 0).toLocaleString("id-ID")} tokens`;
  }

  // 2. Cache Ring & ROI
  if (els.cacheSavingsPercentRing) {
    els.cacheSavingsPercentRing.textContent = `${metrics.cacheEfficiencyPercent ?? 0}%`;
    els.cacheSavingsPercentRing.style.setProperty("--score", metrics.cacheEfficiencyPercent ?? 0);
  }
  if (els.cacheSavedTokensVal) els.cacheSavedTokensVal.textContent = (metrics.cacheSavingsTokens ?? 0).toLocaleString("id-ID");
  if (els.cacheSavedCostVal) els.cacheSavedCostVal.textContent = `$${(metrics.savedCostUSD ?? 0).toFixed(5)}`;

  // 3. Server System Status
  if (els.sysMemoryHeap) els.sysMemoryHeap.textContent = `${system.memoryHeapUsedMB ?? 0} MB`;
  if (els.sysMemoryTotal) els.sysMemoryTotal.textContent = `Allocated: ${system.memoryHeapTotalMB ?? 0} MB`;
  if (els.sysCpuUsage) els.sysCpuUsage.textContent = `${system.cpuUserMs ?? 0} ms`;
  if (els.sysCpuSystem) els.sysCpuSystem.textContent = `Kernel: ${system.cpuSystemMs ?? 0} ms`;
  if (els.sysUptime) els.sysUptime.textContent = formatDuration(system.uptimeSeconds ?? 0);
  if (els.sysNodeVersion) els.sysNodeVersion.textContent = system.nodeVersion || "-";

  // 4. API Logs Table
  if (els.telemetryLogList) {
    if (!logs.length) {
      els.telemetryLogList.innerHTML = '<tr><td colspan="6" class="empty-state">Belum ada log panggilan AI. Data akan muncul setelah AI dipakai pertama kali.</td></tr>';
    } else {
      els.telemetryLogList.innerHTML = logs.map(log => {
        const statusClass = log.status === "success" ? "success" : "error";
        const statusLabel = log.status === "success" ? "SUCCESS" : "ERROR";
        
        const date = log.created_at 
          ? new Date(log.created_at).toLocaleString("id-ID", { 
              day: "numeric", 
              month: "short", 
              hour: "2-digit", 
              minute: "2-digit", 
              second: "2-digit" 
            }) 
          : "-";
          
        const savingsText = log.cache_savings_tokens > 0 
          ? ` <span style="color: var(--emerald); font-weight: 600; font-size: 0.75rem;">(saved ${log.cache_savings_tokens})</span>` 
          : "";

        return `
          <tr>
            <td>
              <strong>${escapeHtml(log.action)}</strong>
              ${log.error_message ? `<div style="font-size: 0.75rem; color: var(--rose); margin-top: 4px; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(log.error_message)}">${escapeHtml(log.error_message)}</div>` : ""}
            </td>
            <td><span style="font-size: 0.8rem; color: var(--muted);">${escapeHtml(log.model)}</span></td>
            <td>${log.latency_ms} ms</td>
            <td>
              ${log.total_tokens}
              <div style="font-size: 0.75rem; color: var(--muted);">${log.prompt_tokens} prompt / ${log.completion_tokens} comp${savingsText}</div>
            </td>
            <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
            <td><span style="font-size: 0.85rem; color: var(--muted);">${date}</span></td>
          </tr>
        `;
      }).join("");
    }
  }
}
