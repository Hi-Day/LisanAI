import { average, compactText, escapeHtml } from "./utils.js";
import { showEmpty } from "./dom.js";
import {
  getSubmissionStatus,
  hasValidScore,
  renderStatusBadge,
} from "./status.js";

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
  const activeTab =
    document.querySelector("#assessmentTabFilter .tab-filter-btn.active")?.dataset.tab || "all";
  let list = state.assessments;
  if (activeTab === "draft") list = list.filter((a) => a.status === "draft");
  if (activeTab === "published") list = list.filter((a) => a.status !== "draft");

  els.assessmentCount.textContent = list.length;
  if (!list.length) {
    const message =
      activeTab === "draft"
        ? "Penilaian yang belum dipublish akan muncul di sini."
        : "Buat penilaian pertama agar dapat ditinjau dan dibagikan ke kelas.";
    showEmpty(els.assessmentList, "list-stack empty-state", message);
    return;
  }

  els.assessmentList.className = "list-stack";
  els.assessmentList.innerHTML = list.map(renderAssessmentItem).join("");
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
        const maxAttempts = assessment.allowRetakes ? Infinity : (Number(assessment.maxAttempts) || 1);
        const used = studentSubmissions.length;
        let attemptsText = `${Math.max(0, maxAttempts - used)} percobaan tersisa`;
        if (Number.isFinite(maxAttempts) && used >= maxAttempts) {
          attemptsText = 'Percobaan habis';
        } else if (!Number.isFinite(maxAttempts)) {
          attemptsText = 'Percobaan tak terbatas';
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
    els.classAverage.textContent = "—";
    els.classAverage.style.setProperty('--score', '0');
    if (els.trendAssessmentCount) els.trendAssessmentCount.textContent = "0 penilaian";
    showEmpty(els.trendList, "trend-list empty-state", EMPTY_TRENDS);
    els.submissionList.className = "";
    els.submissionList.innerHTML = `<tr><td colspan="6" class="empty-state">${EMPTY_SUBMISSIONS}</td></tr>`;
    return;
  }

  // P0: only EVALUATED assessments contribute to academic aggregates.
  const evaluated = visibleSubmissions.filter(hasValidScore);
  const avg = average(evaluated, (submission) => submission.finalScore);
  const avgText = evaluated.length ? String(avg) : "—";
  els.classAverage.textContent = avgText;
  els.classAverage.style.setProperty('--score', avg || 0);
  renderTrend(els, evaluated);
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

export function renderAssessmentItem(assessment) {
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
  const status = getSubmissionStatus(submission);
  const scoreHtml = hasValidScore(submission)
    ? `<span class="metric-pill" style="padding: 4px 12px;">${submission.finalScore}</span>`
    : `<span class="score-muted-text" title="Tidak diterbitkan — evaluasi belum valid">—</span>`;
  return `
    <tr class="submission-row" data-id="${submission.id}">
      <td data-label="Siswa"><strong>${escapeHtml(submission.studentName)}</strong></td>
      <td data-label="Topik">${escapeHtml(submission.assessmentTitle)}</td>
      <td data-label="Tanggal">${date}</td>
      <td data-label="Skor AI">${scoreHtml}</td>
      <td data-label="Status">${renderStatusBadge(status)}</td>
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
    const statusLabel = complaint.status === "resolved" ? "Selesai" : complaint.status === "rejected" ? "Ditolak" : "Menunggu";
    const statusClass = complaint.status === "resolved" ? "complaint-resolved" : complaint.status === "rejected" ? "complaint-rejected" : "complaint-pending";
    complaintHtml = `
      <div class="complaint-box ${statusClass}">
        <strong>📩 Komplain siswa:</strong>
        <p>${escapeHtml(complaint.reason)}</p>
        ${complaint.status === "rejected"
          ? `<p class="complaint-response"><b>Keputusan guru:</b> Komplain ditolak. Skor dikurangi 20 poin.${complaint.response ? ` — ${escapeHtml(complaint.response)}` : ""}</p>`
          : ""}
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

  // Teacher can reject a pending complaint (score -20).
  const rejectBtn = isTeacher && complaint && complaint.status === "pending"
    ? `<button type="button" class="action-button danger-button reject-complaint-btn" data-index="${index}">Tolak Komplain</button>`
    : "";

  return `
    <article class="feedback-card" data-index="${index}">
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <strong>Soal ${index + 1} - Skor <span class="qs-score">${item.score}</span>${durationText}</strong>
        <div style="display: flex; gap: 8px;">
          ${complaintBtn}
          ${respondBtn}
          ${rejectBtn}
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
  const tail = data?.tailLatency || {};
  const prefix = data?.prefixOptimization || {};
  const logs = Array.isArray(data?.logs) ? data.logs : [];
  const pagination = data?.pagination || {};

  // ---- Last updated + loading state ----
  if (els.telemetryLastUpdated) {
    els.telemetryLastUpdated.textContent = data?.lastUpdated
      ? `Last updated ${new Date(data.lastUpdated).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}`
      : "—";
  }

  // ---- KPI cards (PRD §7) ----
  if (els.telemetryTotalCalls) {
    els.telemetryTotalCalls.textContent = metrics.totalCalls != null ? metrics.totalCalls.toLocaleString("id-ID") : "—";
  }
  if (els.telemetryCallsDelta) {
    els.telemetryCallsDelta.textContent =
      metrics.callsToday != null ? `+${metrics.callsToday.toLocaleString("id-ID")} today` : "—";
  }
  if (els.telemetryErrorRate) {
    els.telemetryErrorRate.textContent = metrics.errorRate != null ? `${metrics.errorRate}%` : "—";
  }
  if (els.telemetryErrorHealth) {
    if (metrics.errorRate == null) {
      els.telemetryErrorHealth.textContent = "Telemetry unavailable";
    } else {
      const ok = metrics.errorRate === 0;
      els.telemetryErrorHealth.textContent = ok ? "✓ Healthy" : `⚠ ${metrics.errorRate}% errors`;
      els.telemetryErrorHealth.className = ok ? "ob-kpi-delta ob-good" : "ob-kpi-delta ob-warn";
    }
  }
  if (els.telemetryP50) els.telemetryP50.textContent = formatLatency(metrics.p50LatencyMs);
  if (els.telemetryP95) {
    els.telemetryP95.textContent = formatLatency(metrics.p95LatencyMs);
  }
  if (els.telemetryP95Health) {
    els.telemetryP95Health.textContent =
      tail.flagged
        ? "⚠ High tail latency"
        : formatAvgLabel(metrics.avgLatencyMs);
    els.telemetryP95Health.className = tail.flagged ? "ob-kpi-delta ob-warn" : "ob-kpi-delta";
  }

  // ---- Tail latency alert (PRD §10) ----
  if (els.telemetryTailAlert) {
    if (tail.flagged) {
      els.telemetryTailAlert.className = "ob-alert ob-alert-warn";
      els.telemetryTailAlert.innerHTML = `
        <strong>⚠ High Tail Latency</strong>
        <p>p95 latency is significantly higher than typical request latency.</p>
        <p>p50: ${formatLatency(tail.p50)} &nbsp;·&nbsp; p95: ${formatLatency(tail.p95)}
        ${tail.ratio != null ? ` &nbsp;·&nbsp; p95/p50 = ${tail.ratio}×` : ""}</p>
        <span class="sem-badge sem-derived">ƒ Derived</span>`;
    } else {
      els.telemetryTailAlert.className = "ob-alert hidden";
      els.telemetryTailAlert.innerHTML = "";
    }
  }

  // ---- Latency distribution histogram (PRD §8.1) ----
  if (els.telemetryLatencyDist) {
    const dist = Array.isArray(data?.latencyDistribution) ? data.latencyDistribution : [];
    if (!dist.length) {
      els.telemetryLatencyDist.innerHTML = '<p class="empty-state">Belum ada data latency.</p>';
    } else {
      const max = Math.max(1, ...dist.map((b) => b.count));
      els.telemetryLatencyDist.innerHTML = dist
        .map(
          (b) => `
          <div class="ob-hist-row">
            <span class="ob-hist-label">${escapeHtml(b.label)}</span>
            <div class="ob-hist-track" role="img" aria-label="${escapeHtml(b.label)}: ${b.count} calls">
              <div class="ob-hist-bar" style="width: ${Math.max(2, Math.round((b.count / max) * 100))}%"></div>
            </div>
            <span class="ob-hist-count">${b.count}</span>
          </div>`
        )
        .join("");
    }
  }

  // ---- Percentiles table (PRD §9) ----
  if (els.telemetryPercentileTable) {
    const pRows = [
      ["p50", metrics.p50LatencyMs],
      ["p75", metrics.p75LatencyMs],
      ["p90", metrics.p90LatencyMs],
      ["p95", metrics.p95LatencyMs],
      ["p99", metrics.p99LatencyMs],
    ];
    els.telemetryPercentileTable.innerHTML = pRows
      .map(
        ([label, value]) => `
        <tr>
          <td><code>${label}</code></td>
          <td><strong>${formatLatency(value)}</strong></td>
        </tr>`
      )
      .join("");
  }
  if (els.telemetryTailRatio) {
    els.telemetryTailRatio.innerHTML =
      tail.ratio != null
        ? `<span class="ob-tail-ratio-text">p95 / p50 = ${tail.ratio}× (threshold ${tail.threshold}×)</span>`
        : "";
  }

  // ---- Latency by operation (PRD §11) ----
  renderTableRows(els.telemetryLatencyByOp, data?.latencyByOperation, (row) => `
    <tr>
      <td><code>${escapeHtml(row.operation)}</code></td>
      <td>${row.calls.toLocaleString("id-ID")}</td>
      <td>${formatLatency(row.p50)}</td>
      <td>${formatLatency(row.p95)}</td>
      <td>${formatLatency(row.avg)}</td>
      <td>${row.errorRate != null ? `${row.errorRate}%` : "—"}</td>
    </tr>`, 7, "Belum ada data per operation.");

  // ---- Token analytics (PRD §12-§13) ----
  if (els.telemetryTokens) {
    els.telemetryTokens.textContent = (metrics.totalTokens ?? 0).toLocaleString("id-ID");
  }
  if (els.telemetryTokenSplit) {
    const total = metrics.totalTokens || 0;
    const promptPct = total > 0 ? (metrics.promptTokenPct ?? 0) : 0;
    const completionPct = total > 0 ? (metrics.completionTokenPct ?? 0) : 0;
    els.telemetryTokenSplit.innerHTML = `
      <div class="ob-split-bar" role="img" aria-label="Prompt ${promptPct}%, completion ${completionPct}%">
        <div class="ob-split-prompt" style="width: ${promptPct}%"></div>
        <div class="ob-split-completion" style="width: ${completionPct}%"></div>
      </div>
      <div class="ob-split-legend">
        <span><i class="ob-dot ob-dot-prompt"></i>Prompt ${(metrics.promptTokens ?? 0).toLocaleString("id-ID")} (${promptPct}%)</span>
        <span><i class="ob-dot ob-dot-completion"></i>Completion ${(metrics.completionTokens ?? 0).toLocaleString("id-ID")} (${completionPct}%)</span>
      </div>`;
  }
  if (els.telemetryAvgTokens) els.telemetryAvgTokens.textContent = (metrics.avgTokensPerRequest ?? 0).toLocaleString("id-ID");
  if (els.telemetryAvgPrompt) els.telemetryAvgPrompt.textContent = (metrics.avgPromptPerRequest ?? 0).toLocaleString("id-ID");
  if (els.telemetryAvgCompletion) els.telemetryAvgCompletion.textContent = (metrics.avgCompletionPerRequest ?? 0).toLocaleString("id-ID");
  if (els.telemetryTokensPerCall) els.telemetryTokensPerCall.textContent = (metrics.tokensPerApiCall ?? 0).toLocaleString("id-ID");
  if (els.telemetryTokensPerEval) {
    els.telemetryTokensPerEval.textContent = metrics.tokensPerEvaluation != null
      ? metrics.tokensPerEvaluation.toLocaleString("id-ID")
      : "—";
  }

  // ---- Cost analytics (PRD §14-§15) ----
  if (els.telemetryCost) {
    els.telemetryCost.textContent = metrics.estimatedCostUSD != null ? `$${metrics.estimatedCostUSD.toFixed(5)}` : "—";
  }
  if (els.telemetryCostPerEval) {
    els.telemetryCostPerEval.textContent = metrics.costPerEvaluation != null ? `$${metrics.costPerEvaluation.toFixed(5)}` : "—";
  }
  if (els.telemetryCostPer1K) {
    els.telemetryCostPer1K.textContent = metrics.costPer1KTokens != null ? `$${metrics.costPer1KTokens.toFixed(5)}` : "—";
  }
  renderTableRows(els.telemetryCostByOp, data?.costByOperation, (row) => `
    <tr>
      <td><code>${escapeHtml(row.operation)}</code></td>
      <td>${row.calls.toLocaleString("id-ID")}</td>
      <td>${row.tokens.toLocaleString("id-ID")}</td>
      <td>$${(row.estimatedCostUSD ?? 0).toFixed(5)}</td>
    </tr>`, 4, "Belum ada data biaya per operation.");

  // ---- Prefix Optimization (PRD §16-§19) ----
  if (els.telemetryPrefixTokens) {
    els.telemetryPrefixTokens.textContent = `${(prefix.estimatedSavedTokens ?? 0).toLocaleString("id-ID")} tokens`;
  }
  if (els.telemetryPrefixPct) {
    els.telemetryPrefixPct.textContent = `${prefix.estimatedPrefixReusePct ?? 0}%`;
  }
  if (els.telemetryPrefixCost) {
    els.telemetryPrefixCost.textContent = prefix.estimatedSavedCostUSD != null
      ? `$${prefix.estimatedSavedCostUSD.toFixed(5)}`
      : "—";
  }
  if (els.telemetryCacheHits) {
    els.telemetryCacheHits.textContent = prefix.actualCacheHits != null
      ? prefix.actualCacheHits.toLocaleString("id-ID")
      : "Not available";
  }
  if (els.telemetryCacheMisses) {
    els.telemetryCacheMisses.textContent = prefix.actualCacheMisses != null
      ? prefix.actualCacheMisses.toLocaleString("id-ID")
      : "Not available";
  }
  if (els.telemetryKvStatus) {
    els.telemetryKvStatus.innerHTML = prefix.kvCacheAvailable
      ? `<span class="ob-kv-status-ok">✓ ${escapeHtml(prefix.statusNote || "Actual provider KV-cache telemetry available.")}</span>`
      : `<span class="ob-kv-status-muted">ℹ ${escapeHtml(prefix.statusNote || "Actual provider KV-cache telemetry unavailable.")}</span>`;
  }

  // ---- AI provider performance (PRD §20) ----
  renderTableRows(els.telemetryProviderTable, data?.providerPerformance, (row) => `
    <tr>
      <td><code>${escapeHtml(row.model)}</code></td>
      <td>${row.calls.toLocaleString("id-ID")}</td>
      <td>${formatLatency(row.p50)}</td>
      <td>${formatLatency(row.p95)}</td>
      <td>${row.totalTokens.toLocaleString("id-ID")}</td>
      <td>$${(row.estimatedCostUSD ?? 0).toFixed(5)}</td>
      <td>${row.errorRate != null ? `${row.errorRate}%` : "—"}</td>
    </tr>`, 7, "Belum ada data provider.");

  // ---- Slowest calls (PRD §21) ----
  renderTableRows(els.telemetrySlowestCalls, data?.slowestCalls, (row, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><code>${escapeHtml(row.action)}</code></td>
      <td><strong>${formatLatency(row.latency_ms)}</strong></td>
      <td>${(row.total_tokens ?? 0).toLocaleString("id-ID")}</td>
      <td style="font-size: 0.8rem; color: var(--muted);">${escapeHtml(row.model)}</td>
      <td><span class="status-badge ${row.status === "success" ? "success" : "error"}">${escapeHtml((row.status || "—").toUpperCase())}</span></td>
      <td style="font-size: 0.85rem; color: var(--muted);">${formatDateTime(row.created_at)}</td>
    </tr>`, 7, "Belum ada panggilan lambat.");

  // ---- System health (PRD §24-§26) ----
  renderSystemHealth(els, system);

  // ---- Log filters population ----
  if (els.telemetryFilterOp) {
    const ops = data?.logFilters?.operations || [];
    const current = els.telemetryFilterOp.value;
    els.telemetryFilterOp.innerHTML =
      '<option value="">Semua operation</option>' +
      ops.map((op) => `<option value="${escapeHtml(op)}" ${op === current ? "selected" : ""}>${escapeHtml(op)}</option>`).join("");
  }
  if (els.telemetryFilterModel) {
    const models = data?.logFilters?.models || [];
    const current = els.telemetryFilterModel.value;
    els.telemetryFilterModel.innerHTML =
      '<option value="">Semua model</option>' +
      models.map((m) => `<option value="${escapeHtml(m)}" ${m === current ? "selected" : ""}>${escapeHtml(m)}</option>`).join("");
  }
  if (els.telemetryLogCount) {
    els.telemetryLogCount.textContent = pagination.total != null
      ? `${pagination.total.toLocaleString("id-ID")} calls${pagination.offset > 0 ? ` (offset ${pagination.offset})` : ""}`
      : "";
  }

  // ---- AI call log table (PRD §22-§23) ----
  if (els.telemetryLogList) {
    if (!logs.length) {
      els.telemetryLogList.innerHTML = `<tr><td colspan="6" class="empty-state">Baru ada log panggilan AI. Data akan muncul setelah AI dipakai pertama kali.</td></tr>`;
    } else {
      els.telemetryLogList.innerHTML = logs.map(renderLogRow).join("");
    }
  }
}

function renderLogRow(log) {
  const statusClass = log.status === "success" ? "success" : "error";
  const statusLabel = log.status === "success" ? "SUCCESS" : "ERROR";
  const hasSaved = log.estimated_prefix_cache_savings > 0;
  const cacheHitText = log.cache_read_input_tokens > 0
    ? ` · cache-hit ${log.cache_read_input_tokens}`
    : "";
  const retryText = log.retry_count > 0 ? ` · retries ${log.retry_count}` : "";

  return `
    <tr>
      <td>
        <strong>${escapeHtml(log.action)}</strong>
        ${log.error_message ? `<div style="font-size: 0.75rem; color: var(--rose); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(log.error_message)}">${escapeHtml(log.error_message)}</div>` : ""}
      </td>
      <td><span style="font-size: 0.8rem; color: var(--muted);">${escapeHtml(log.model)}</span></td>
      <td>${formatLatency(log.latency_ms)}</td>
      <td>
        <strong>${(log.total_tokens ?? 0).toLocaleString("id-ID")}</strong>
        <div style="font-size: 0.75rem; color: var(--muted);">
          Prompt: ${(log.prompt_tokens ?? 0).toLocaleString("id-ID")}
          · Completion: ${(log.completion_tokens ?? 0).toLocaleString("id-ID")}
          ${hasSaved ? `<div style="color: var(--emerald);">Estimated reusable prefix: ${log.estimated_prefix_cache_savings.toLocaleString("id-ID")}</div>` : ""}
          ${cacheHitText ? `<span style="color: var(--sky);">${cacheHitText}</span>` : ""}
          ${retryText ? `<span style="color: var(--amber);">${retryText}</span>` : ""}
        </div>
      </td>
      <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
      <td><span style="font-size: 0.85rem; color: var(--muted);">${formatDateTime(log.created_at)}</span></td>
    </tr>`;
}

function renderSystemHealth(els, system) {
  if (els.telemetryRestartAlert && system.restart) {
    const r = system.restart;
    if (r.recentlyRestarted) {
      els.telemetryRestartAlert.className = "ob-alert ob-alert-warn";
      els.telemetryRestartAlert.innerHTML = `
        <strong>⚠ Server recently restarted</strong>
        <p>Current uptime: ${formatDuration(r.uptimeSeconds ?? 0)}${r.restartCount != null ? ` · Restart count: ${r.restartCount}` : ""}</p>
        <span class="sem-badge sem-derived">ƒ Derived</span>`;
    } else {
      els.telemetryRestartAlert.className = "ob-alert hidden";
      els.telemetryRestartAlert.innerHTML = "";
    }
  }

  if (els.sysHealthList) {
    const items = [
      { label: "API", status: system.apiHealthy ? "✓ Healthy" : "✗ Unhealthy", ok: system.apiHealthy !== false },
      { label: "Database", status: system.databaseHealthy ? "✓ Healthy" : "✗ Unhealthy", ok: system.databaseHealthy !== false },
      { label: "AI Provider", status: system.providerHealthy ? "✓ Healthy" : "⚠ Degraded", ok: system.providerHealthy !== false },
      { label: "Memory", status: `${system.memoryHeapUsedMB ?? 0} MB / ${system.memoryHeapTotalMB ?? 0} MB`, ok: null },
      { label: "CPU Process", status: `${system.cpuUserMs ?? 0} ms`, ok: null },
      { label: "Uptime", status: formatDuration(system.uptimeSeconds ?? 0), ok: null },
    ];
    els.sysHealthList.innerHTML = items
      .map(
        (item) => `
        <div class="ob-block ob-sys-item">
          <span class="ob-sys-label">${escapeHtml(item.label)}</span>
          <strong class="${item.ok === true ? "ob-good" : item.ok === false ? "ob-warn" : ""}">${escapeHtml(item.status)}</strong>
        </div>`
      )
      .join("");
  }

  if (els.sysMemoryHeap) els.sysMemoryHeap.textContent = `${system.memoryHeapUsedMB ?? 0} MB`;
  if (els.sysMemoryTotal) els.sysMemoryTotal.textContent = `Allocated: ${system.memoryHeapTotalMB ?? 0} MB`;
  if (els.sysCpuUsage) els.sysCpuUsage.textContent = `${system.cpuUserMs ?? 0} ms`;
  if (els.sysCpuSystem) els.sysCpuSystem.textContent = `Kernel: ${system.cpuSystemMs ?? 0} ms`;
  if (els.sysUptime) els.sysUptime.textContent = formatDuration(system.uptimeSeconds ?? 0);
  if (els.sysNodeVersion) els.sysNodeVersion.textContent = system.nodeVersion || "-";
}

function renderTableRows(container, rows, rowRenderer, colspan, emptyText) {
  if (!container) return;
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    container.innerHTML = `<tr><td colspan="${colspan}" class="empty-state">${emptyText}</td></tr>`;
    return;
  }
  container.innerHTML = list.map(rowRenderer).join("");
}

function formatLatency(ms) {
  if (ms == null || Number.isNaN(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${Math.round(s * 10) / 10} s`;
  return `${Math.round(s / 60 * 10) / 10} min`;
}

function formatAvgLabel(ms) {
  if (ms == null) return "Avg n/a";
  return `Avg ${formatLatency(ms)}`;
}

function formatDateTime(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
