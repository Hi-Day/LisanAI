import { average, compactText } from "./utils.js";
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
  els.studentSelect.innerHTML = state.assessments.map(renderAssessmentOption).join("");

  if (!state.assessments.length) {
    els.studentEmpty.classList.remove("hidden");
    els.studentEmpty.textContent = EMPTY_STUDENT;
    els.studentWorkspace.classList.add("hidden");
    els.resultPanel.classList.add("hidden");
    return;
  }

  els.studentEmpty.classList.add("hidden");
  els.studentWorkspace.classList.remove("hidden");
  els.studentSelect.value = session.currentAssessmentId;
  renderQuestion(els, session.getCurrentAssessment(), session);
}

export function renderQuestion(els, assessment, session) {
  if (!assessment) return;
  const question = assessment.questions[session.currentQuestionIndex];

  els.questionProgress.textContent = `Soal ${session.currentQuestionIndex + 1} dari ${assessment.questions.length}`;
  els.activeDifficulty.textContent = assessment.difficulty;
  els.activeQuestion.textContent = question.prompt;
  els.activeHint.textContent = question.ideal;
  els.answerText.value = session.currentAnswers[session.currentQuestionIndex] || "";
  els.prevQuestion.disabled = session.currentQuestionIndex === 0;
  renderAnswerMap(els, assessment, session.currentAnswers);
}

export function renderMonitoring(els, state) {
  els.submissionCount.textContent = state.submissions.length;

  if (!state.submissions.length) {
    els.classAverage.textContent = "0";
    showEmpty(els.trendList, "trend-list empty-state", EMPTY_TRENDS);
    showEmpty(els.submissionList, "list-stack empty-state", EMPTY_SUBMISSIONS);
    return;
  }

  els.classAverage.textContent = average(state.submissions, (submission) => submission.finalScore);
  renderTrend(els, state.submissions);
  renderSubmissions(els, state.submissions);
}

export function showResult(els, submission) {
  els.resultPanel.classList.remove("hidden");
  els.resultPanel.innerHTML = `
    <div class="result-header">
      <div>
        <h3>Hasil assessment: ${submission.assessmentTitle}</h3>
        <p>${submission.feedback}</p>
      </div>
      <div class="score-badge">${submission.finalScore}</div>
    </div>
    <div class="feedback-grid">
      ${submission.questionScores.map(renderFeedbackCard).join("")}
    </div>
  `;
}

function renderAssessmentItem(assessment) {
  return `
    <article class="assessment-item">
      <div>
        <strong>${assessment.topic}</strong>
        <p>${compactText(assessment.outcomes)}</p>
      </div>
      <span>${assessment.questions.length} soal</span>
    </article>
  `;
}

function renderAssessmentOption(assessment) {
  return `<option value="${assessment.id}">${assessment.topic}</option>`;
}

function renderAnswerMap(els, assessment, answers) {
  els.answerMap.innerHTML = assessment.questions
    .map((_, index) => `<div class="answer-dot ${answers[index] ? "done" : ""}">${index + 1}</div>`)
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
  els.submissionList.className = "list-stack";
  els.submissionList.innerHTML = submissions.slice().reverse().map(renderSubmissionItem).join("");
}

function renderSubmissionItem(submission) {
  return `
    <article class="submission-item">
      <div>
        <strong>${submission.studentName} - ${submission.assessmentTitle}</strong>
        <p>${submission.feedback}</p>
      </div>
      <div class="score-badge">${submission.finalScore}</div>
    </article>
  `;
}

function renderTrendItem(trend) {
  const deltaLabel = `${trend.delta >= 0 ? "+" : ""}${trend.delta}`;
  return `
    <div class="trend-item">
      <header>
        <strong>${trend.studentName}</strong>
        <span>${trend.latest} (${deltaLabel})</span>
      </header>
      <div class="trend-track"><div class="trend-fill" style="width: ${trend.latest}%"></div></div>
    </div>
  `;
}

function renderFeedbackCard(item, index) {
  return `
    <article class="feedback-card">
      <strong>Soal ${index + 1} - Skor ${item.score}</strong>
      <p>${item.question}</p>
      <p><b>Sudah tepat:</b> ${item.strengths.join(" ")}</p>
      <p><b>Masih kurang:</b> ${item.gaps.join(" ")}</p>
      <div class="tag-row">
        ${item.matched.slice(0, 5).map((keyword) => `<span class="tag">${keyword}</span>`).join("")}
      </div>
    </article>
  `;
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
