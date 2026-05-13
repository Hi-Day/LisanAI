import { DEFAULT_QUESTION_COUNT } from "./config.js";
import {
  clearDatabase,
  evaluateAssessmentWithAI,
  generateQuestionsWithAI,
  saveAssessmentToDatabase,
  saveSubmissionToDatabase,
} from "./api.js";
import { createAssessment, createDemoAssessment, createSubmission, readAssessmentForm } from "./assessment-factory.js";
import { getElements, setButtonLoading } from "./dom.js";
import { evaluateFallbackAssessment, generateFallbackQuestions } from "./fallback-assessment.js";
import { createRecorder } from "./recorder.js";
import { renderApp, renderMonitoring, renderQuestion, showResult } from "./render.js";
import { createSession } from "./session.js";
import { loadState } from "./storage.js";

export async function initApp() {
  const els = getElements();
  const state = await loadState();
  const session = createSession(state);
  const recorder = createRecorder(els);

  function renderCurrentState() {
    session.ensureAssessmentSelected();
    renderApp(els, state, session);
  }

  function saveCurrentAnswer() {
    session.saveAnswer(els.answerText.value);
  }

  async function handleAssessmentSubmit(event) {
    event.preventDefault();
    const config = readAssessmentForm(els);

    setButtonLoading(event.submitter, true, "Menghubungi AI...", "Generate assessment");
    try {
      const questions = await generateQuestionsWithFallback(config);
      const assessment = createAssessment(config, questions);
      await saveAssessmentToDatabase(assessment);
      state.assessments.unshift(assessment);
      session.selectAssessment(assessment.id);
      event.target.reset();
      els.questionCount.value = DEFAULT_QUESTION_COUNT;
      renderCurrentState();
    } finally {
      setButtonLoading(event.submitter, false, "Menghubungi AI...", "Generate assessment");
    }
  }

  async function generateQuestionsWithFallback(config) {
    try {
      return await generateQuestionsWithAI(config);
    } catch (error) {
      alert(`AI belum tersedia, memakai generator lokal. Detail: ${error.message}`);
      return generateFallbackQuestions(config);
    }
  }

  async function handleFinishAssessment() {
    const assessment = session.getCurrentAssessment();
    if (!assessment) return;

    saveCurrentAnswer();
    const studentName = els.studentName.value.trim() || "Siswa tanpa nama";
    setButtonLoading(els.finishAssessment, true, "Menilai dengan AI...", "Selesaikan assessment");

    try {
      const submission = await evaluateWithFallback(assessment, studentName);
      await saveSubmissionToDatabase(submission);
      state.submissions.push(submission);
      renderMonitoring(els, state);
      showResult(els, submission);
    } finally {
      setButtonLoading(els.finishAssessment, false, "Menilai dengan AI...", "Selesaikan assessment");
    }
  }

  async function evaluateWithFallback(assessment, studentName) {
    try {
      return await evaluateAssessmentWithAI(assessment, session.currentAnswers, studentName, createSubmission);
    } catch (error) {
      alert(`AI belum tersedia, memakai penilaian lokal. Detail: ${error.message}`);
      return evaluateFallbackAssessment(assessment, session.currentAnswers, studentName, createSubmission);
    }
  }

  function switchView(viewId) {
    els.navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === viewId));
    els.views.forEach((view) => view.classList.toggle("active", view.id === viewId));
  }

  function bindEvents() {
    els.navButtons.forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.view));
    });

    els.form.addEventListener("submit", handleAssessmentSubmit);

    els.studentSelect.addEventListener("change", (event) => {
      recorder.stop();
      session.selectAssessment(event.target.value);
      els.resultPanel.classList.add("hidden");
      renderQuestion(els, session.getCurrentAssessment(), session);
      recorder.resetStatus();
    });

    els.recordButton.addEventListener("click", () => {
      recorder.toggle().catch((error) => {
        els.recordStatus.textContent = error.message || "Mikrofon belum bisa digunakan. Ketik jawaban manual.";
        els.recordButton.classList.remove("recording");
        els.recordButton.disabled = false;
      });
    });

    els.prevQuestion.addEventListener("click", () => {
      recorder.stop();
      saveCurrentAnswer();
      session.goPrevious();
      renderQuestion(els, session.getCurrentAssessment(), session);
      recorder.resetStatus();
    });

    els.saveAnswer.addEventListener("click", () => {
      recorder.stop();
      saveCurrentAnswer();
      session.goNext();
      renderQuestion(els, session.getCurrentAssessment(), session);
      recorder.resetStatus();
    });

    els.finishAssessment.addEventListener("click", handleFinishAssessment);

    els.seedDemo.addEventListener("click", () => {
      if (state.assessments.length) return;
      const assessment = createDemoAssessment(generateFallbackQuestions);
      saveAssessmentToDatabase(assessment)
        .then(() => {
          state.assessments.push(assessment);
          renderCurrentState();
        })
        .catch((error) => alert(`Gagal menyimpan contoh data: ${error.message}`));
    });

    els.resetData.addEventListener("click", async () => {
      if (!confirm("Reset semua assessment dan hasil?")) return;
      await clearDatabase();
      state.assessments = [];
      state.submissions = [];
      session.ensureAssessmentSelected();
      renderCurrentState();
    });
  }

  bindEvents();
  renderCurrentState();
}
