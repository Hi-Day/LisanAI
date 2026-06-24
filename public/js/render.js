import { average, compactText, escapeHtml } from "./utils.js";
import { showEmpty } from "./dom.js";

const EMPTY_ASSESSMENTS = "Belum ada assessment. Buat konfigurasi pertama untuk mulai.";
const EMPTY_STUDENT = "Belum ada assessment yang tersedia untuk siswa.";
const EMPTY_SUBMISSIONS = "Belum ada hasil assessment.";
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
  let visibleAssessments = state.assessments;
  if (selectedClassId) {
    visibleAssessments = state.assessments.filter(a => a.classId === selectedClassId);
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
        let scoreHtml = '';
        let buttonText = 'Mulai Kerjakan';
        let buttonClass = 'primary-button start-assessment-btn';
        
        if (hasSubmitted) {
          const latestSubmission = studentSubmissions.slice().sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0];
          scoreHtml = `<p style="margin: 8px 0 0; font-size: 0.95rem; font-weight: 600; color: var(--emerald);">Nilai sebelumnya: ${latestSubmission.finalScore}</p>`;
          if (assessment.allowRetakes) {
            buttonText = 'Kerjakan Ulang';
            buttonClass = 'secondary-button start-assessment-btn';
          } else {
            buttonText = 'Sudah Dikumpulkan';
            buttonClass = 'secondary-button';
          }
        }
        
        return `
          <div class="assessment-card" data-id="${assessment.id}">
            <h4>${escapeHtml(assessment.topic)}</h4>
            <span class="tag badge-published" style="width: fit-content;">${escapeHtml(assessment.difficulty)}</span>
            <p style="margin: 0; font-size: 0.9rem; color: var(--muted);">${assessment.questions.length} Soal</p>
            ${scoreHtml}
            <button type="button" class="${buttonClass}" data-id="${assessment.id}" style="margin-top: auto;" ${hasSubmitted && !assessment.allowRetakes ? "disabled" : ""}>${buttonText}</button>
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
  els.activeHint.textContent = question.ideal;
  
  if (assessment.disableManualTyping) {
    els.answerText.placeholder = "Jawaban manual dimatikan untuk assessment ini. Silakan menjawab menggunakan rekaman suara.";
    els.answerText.readOnly = true;
    if (els.recordInstructions) {
      els.recordInstructions.textContent = "Gunakan Chrome/Edge di http://127.0.0.1:4173 dan izinkan mikrofon. Siswa wajib menjawab secara lisan (pengetikan manual dinonaktifkan).";
    }
  } else {
    els.answerText.placeholder = "Transkripsi otomatis atau jawaban manual siswa akan muncul di sini";
    els.answerText.readOnly = false;
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
  let visibleSubmissions = state.submissions;
  if (selectedClassId) {
    visibleSubmissions = state.submissions.filter(s => s.classId === selectedClassId);
  }

  els.submissionCount.textContent = visibleSubmissions.length;

  if (els.downloadClassCsvBtn) {
    els.downloadClassCsvBtn.style.display = selectedClassId ? "inline-flex" : "none";
  }

  if (!visibleSubmissions.length) {
    els.classAverage.textContent = "0";
    els.classAverage.style.setProperty('--score', '0');
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
  els.resultPanel.classList.remove("hidden");
  els.resultPanel.dataset.submissionId = submission.id; // Store ID for override
  els.resultPanel.innerHTML = `
    <div class="result-modal-content">
      <button class="result-close-btn" type="button" aria-label="Tutup Hasil" onclick="document.getElementById('resultPanel').classList.add('hidden')">&times;</button>
      <div class="result-header">
        <div style="flex: 1; min-width: 0;">
          <h3 style="margin-right: 40px;">Hasil assessment: ${escapeHtml(submission.assessmentTitle)}</h3>
          <p>${formatRichText(submission.feedback)}</p>
        </div>
        <div class="score-badge">${submission.finalScore}</div>
      </div>
      <div class="feedback-grid">
        ${submission.questionScores.map((item, index) => renderFeedbackCard(item, index, auth)).join("")}
      </div>
      <div class="result-footer">
        <button class="primary-button" type="button" onclick="document.getElementById('resultPanel').classList.add('hidden')">Tutup</button>
      </div>
    </div>
  `;
}

function renderAssessmentItem(assessment) {
  const statusBadgeClass = `badge-${assessment.status || 'published'}`;
  const statusLabel = assessment.status === 'draft' ? 'Draft' : (assessment.status === 'closed' ? 'Closed' : 'Published');
  
  return `
    <article class="assessment-item" data-id="${assessment.id}">
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <strong style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(assessment.topic)}</strong>
          <span class="tag ${statusBadgeClass}" style="padding: 2px 6px; font-size: 0.65rem;">${statusLabel}</span>
        </div>
        <p>${escapeHtml(compactText(assessment.outcomes))}</p>
        <div class="item-actions">
          <button type="button" class="action-button edit-assessment">Edit Soal</button>
          <button type="button" class="action-button toggle-status-assessment">${assessment.status === 'published' ? 'Close' : 'Publish'}</button>
          <button type="button" class="action-button download-grades-assessment">Download Nilai</button>
          <button type="button" class="action-button danger-button delete-assessment">Hapus</button>
        </div>
      </div>
      <span>${assessment.questions.length} soal</span>
    </article>
  `;
}

function renderAnswerMap(els, assessment, answers) {
  els.answerMap.innerHTML = assessment.questions
    .map((_, index) => `<div class="answer-dot ${answers[index]?.text ? "done" : ""}">${index + 1}</div>`)
    .join("");
}

function renderTrend(els, submissions) {
  const trends = buildTrends(submissions);

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
      <td><strong>${escapeHtml(submission.studentName)}</strong></td>
      <td>${escapeHtml(submission.assessmentTitle)}</td>
      <td>${date}</td>
      <td><span class="metric-pill" style="padding: 4px 12px;">${submission.finalScore}</span></td>
      <td>
        <button type="button" class="secondary-button view-submission-btn" style="min-height: 36px; font-size: 0.9rem;">Lihat Detail</button>
      </td>
    </tr>
  `;
}

function renderTrendItem(trend) {
  const deltaLabel = `${trend.delta >= 0 ? "+" : ""}${trend.delta}`;
  return `
    <div class="trend-item">
      <header>
        <strong>${escapeHtml(trend.studentName)}</strong>
        <span>${trend.latest} (${deltaLabel})</span>
      </header>
      <div class="trend-track"><div class="trend-fill" style="width: ${trend.latest}%"></div></div>
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
  const durationText = item.duration !== undefined ? ` | ⏱️ ${formatDuration(item.duration)}` : '';

  return `
    <article class="feedback-card" data-index="${index}">
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <strong>Soal ${index + 1} - Skor <span class="qs-score">${item.score}</span>${durationText}</strong>
        <button type="button" class="action-button edit-override-btn ${isTeacher ? '' : 'hidden'}" data-index="${index}">Koreksi</button>
      </div>
      <p>${formatRichText(item.question)}</p>
      ${audioHtml}
      <p><b>Jawaban:</b> <i>"${escapeHtml(item.answer || (item.audio ? 'Hanya audio' : 'Tidak ada jawaban'))}"</i></p>
      <p><b>Kelebihan:</b> <span class="qs-strengths">${formatRichText(item.strengths?.join(" ") || "")}</span></p>
      <p><b>Masih kurang:</b> <span class="qs-gaps">${formatRichText(item.gaps?.join(" ") || "")}</span></p>
      <div class="tag-row">
        ${(item.matched || []).slice(0, 5).map((keyword) => `<span class="tag">${escapeHtml(keyword)}</span>`).join("")}
      </div>
    </article>
  `;
}

function formatRichText(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
    .replace(/\n/g, "<br>");
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
      return { studentName, latest, delta: latest - previous };
    })
    .sort((a, b) => b.latest - a.latest);
}

export function renderStudentHistory(els, submissions, currentStudentName) {
  const studentSubmissions = submissions.filter(s => s.studentName === currentStudentName);
  
  if (!studentSubmissions.length) {
    els.studentHistoryList.innerHTML = '<tr><td colspan="4" class="empty-state">Belum ada riwayat assessment.</td></tr>';
    return;
  }
  
  els.studentHistoryList.innerHTML = studentSubmissions.slice().reverse().map(sub => {
    const date = sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : "-";
    return `
      <tr class="submission-row" data-id="${sub.id}">
        <td><strong>${escapeHtml(sub.assessmentTitle)}</strong></td>
        <td>${date}</td>
        <td><span class="metric-pill" style="padding: 4px 12px;">${sub.finalScore}</span></td>
        <td>
          <button type="button" class="secondary-button view-submission-btn" style="min-height: 36px; font-size: 0.9rem;">Lihat Hasil</button>
        </td>
      </tr>
    `;
  }).join('');
}
