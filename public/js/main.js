import { showToast } from './toast.js';
import { DEFAULT_QUESTION_COUNT } from "./config.js";
import {
  clearDatabase,
  approveJoinRequest,
  createClassroom,
  createUser,
  deleteAssessment,
  deleteClassroom,
  deleteMembership,
  deleteUser,
  evaluateAssessmentWithAI,
  generateQuestionsWithAI,
  getCurrentUser,
  improveQuestionsWithAI,
  joinClass,
  listUsers,
  login,
  logout,
  recommendAssessmentConfig,
  registerTenant,
  saveAssessmentToDatabase,
  saveSubmissionToDatabase,
  updateAssessment,
  updateClassroom,
  updateMembership,
  updateUser,
  getSimulationData,
  simulateLogin,
} from "./api.js";
import { createAssessment, createDemoAssessment, createSubmission, readAssessmentForm } from "./assessment-factory.js";
import { getElements, setButtonLoading } from "./dom.js";
import { evaluateFallbackAssessment, generateFallbackQuestions, recommendFallbackConfig } from "./fallback-assessment.js";
import { createRecorder } from "./recorder.js";
import { renderApp, renderMonitoring, renderStudentHistory, renderQuestion, showResult, renderObservability } from "./render.js";
import { createSession } from "./session.js";
import { loadState } from "./storage.js";
import { escapeHtml } from "./utils.js";

export async function initApp() {
  const els = getElements();
  let auth = await getCurrentUser();
  let state = { assessments: [], submissions: [] };
  let users = [];
  let pendingAssessmentConfig = null;
  let pendingQuestions = [];
  let session = createSession(state);
  const recorder = createRecorder(els);

  async function bootstrapAuthenticatedApp(nextAuth = auth) {
    auth = nextAuth;
    state = await loadState();
    session = createSession(state);
    users = auth.user.role === "admin" ? await loadUsers() : [];
    clearAuthForms();
    showApp();
    applyRoleAccess();
    renderCurrentState();
    renderUsers();
    refreshSimulatorIfEnabled();
  }

  function showAuth() {
    els.authView.classList.remove("hidden");
    els.appShell.classList.add("hidden");
  }

  function showApp() {
    els.authView.classList.add("hidden");
    els.appShell.classList.remove("hidden");
    els.accountName.textContent = auth.user.name;
    els.tenantName.textContent = auth.tenant.name;
    els.accountRole.textContent = roleLabel(auth.user.role);
  }

  function clearAuthForms() {
    els.loginForm.reset();
    els.registerForm.reset();
  }

  function isAssessmentLocked(assessment) {
    if (!assessment) return false;
    const studentSubmissions = state.submissions.filter((submission) => submission.assessmentId === assessment.id);
    return studentSubmissions.length > 0 && !assessment.allowRetakes;
  }

  function renderCurrentState() {
    if (auth.user?.role !== "student") {
      session.ensureAssessmentSelected();
    } else {
      if (session.currentAssessmentId && !state.assessments.some((a) => a.id === session.currentAssessmentId)) {
        session.currentAssessmentId = null;
      }

      const currentAssessment = session.getCurrentAssessment();
      if (currentAssessment && isAssessmentLocked(currentAssessment)) {
        session.currentAssessmentId = null;
        session.currentAnswers = [];
        session.currentQuestionIndex = 0;
      }
    }
    renderApp(els, state, session);
    if (auth.user) renderStudentHistory(els, state.submissions, auth.user.name);
    renderClasses();
    renderQuestionEditor();
    if (auth.user?.role === "student") {
      els.studentName.value = auth.user.name;
      els.studentName.readOnly = true;
    } else {
      els.studentName.readOnly = false;
    }
  }

  async function loadUsers() {
    try {
      return await listUsers();
    } catch (error) {
      showToast(`Gagal memuat user tenant: ${error.message}`);
      return [];
    }
  }

  function renderUsers() {
    if (auth.user?.role !== "admin") return;
    const extraUsers = users.filter((user) => user.id !== auth.user.id);
    if (!extraUsers.length) {
      els.userList.className = "list-stack empty-state";
      els.userList.textContent = "Belum ada akun tambahan.";
      return;
    }

    els.userList.className = "list-stack";
    els.userList.innerHTML = extraUsers.map((user) => `
      <article class="submission-item" data-id="${user.id}">
        <div style="flex: 1; min-width: 0;">
          <strong>${escapeHtml(user.name)}</strong>
          <p>${escapeHtml(user.email)}</p>
          <div class="item-actions">
            <button type="button" class="action-button edit-user">Ubah Role</button>
            <button type="button" class="action-button danger-button delete-user">Hapus</button>
          </div>
        </div>
        <span class="user-role">${escapeHtml(roleLabel(user.role))}</span>
      </article>
    `).join("");
  }

  function renderClasses() {
    const isStudent = auth.user?.role === "student";
    els.classForm.classList.toggle("hidden", isStudent);
    els.joinClassForm.classList.toggle("hidden", !isStudent);
    els.pendingJoinList.classList.toggle("hidden", isStudent);

    const usableClasses = state.classes.filter((item) => !isStudent || item.status === "approved");
    els.classSelect.innerHTML = usableClasses.length
      ? usableClasses.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("")
      : `<option value="">Belum ada kelas</option>`;

    if (els.monitorClassFilter && !isStudent) {
      const currentVal = els.monitorClassFilter.value;
      els.monitorClassFilter.innerHTML = `<option value="">Semua Kelas</option>` +
        state.classes.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join("");
      if (currentVal && state.classes.some(c => c.id === currentVal)) {
        els.monitorClassFilter.value = currentVal;
      }
    }


    if (!state.classes.length) {
      els.classList.className = "list-stack empty-state";
      els.classList.textContent = isStudent ? "Belum join kelas." : "Belum ada kelas.";
    } else {
      els.classList.className = "list-stack";
      els.classList.innerHTML = state.classes.map((item) => `
      <article class="submission-item" data-id="${escapeHtml(item.id)}">
          <div style="flex: 1; min-width: 0;">
            <strong>${escapeHtml(item.name)}</strong>
            <p>Kode: <b>${escapeHtml(item.join_code || item.joinCode || "-")}</b></p>
            ${!isStudent ? `
              <div class="item-actions">
                <button type="button" class="action-button edit-class">Edit</button>
                <button type="button" class="action-button danger-button delete-class">Hapus</button>
              </div>
            ` : ""}
          </div>
        </article>
      `).join("");
    }

    if (isStudent) {
      const activeClasses = state.classes.filter(c => c.status === "approved" || c.status === "pending");
      if (!activeClasses.length) {
        els.studentClassList.className = "list-stack empty-state";
        els.studentClassList.textContent = "Belum join kelas.";
      } else {
        els.studentClassList.className = "list-stack";
        els.studentClassList.innerHTML = activeClasses.map((item) => `
          <article class="submission-item">
            <div>
              <strong>${escapeHtml(item.name)}</strong>
              <p>Status: ${item.status === 'approved' ? 'Disetujui' : 'Menunggu'}</p>
            </div>
          </article>
        `).join("");
      }

      if (els.studentClassFilter) {
        const approvedClasses = activeClasses.filter(c => c.status === "approved");
        const currentVal = els.studentClassFilter.value;
        els.studentClassFilter.innerHTML = `<option value="">Semua Kelas</option>` +
          approvedClasses.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join("");
        if (currentVal && approvedClasses.some(c => c.id === currentVal)) {
          els.studentClassFilter.value = currentVal;
        }
      }
    }

    if (els.approvedMemberList) els.approvedMemberList.classList.toggle("hidden", isStudent);

    const pending = state.memberships.filter((item) => item.status === "pending");
    if (!pending.length) {
      els.pendingJoinList.className = "list-stack empty-state";
      els.pendingJoinList.textContent = "Belum ada request join.";
    } else {
      els.pendingJoinList.className = "list-stack";
      els.pendingJoinList.innerHTML = pending.map((item) => `
        <article class="submission-item">
          <div>
            <strong>${escapeHtml(item.student_name)}</strong>
            <p>${escapeHtml(item.student_email)} - ${escapeHtml(item.class_name)}</p>
          </div>
          <div class="item-actions">
            <button class="secondary-button approve-join" data-id="${escapeHtml(item.id)}" type="button">Approve</button>
            <button class="action-button danger-button reject-join" data-id="${escapeHtml(item.id)}" type="button">Tolak</button>
          </div>
        </article>
      `).join("");
    }

    if (els.approvedMemberList) {
      const approved = state.memberships.filter((item) => item.status === "approved");
      if (!approved.length) {
        els.approvedMemberList.className = "list-stack empty-state";
        els.approvedMemberList.textContent = "Belum ada anggota.";
      } else {
        els.approvedMemberList.className = "list-stack";
        els.approvedMemberList.innerHTML = approved.map((item) => `
          <article class="submission-item">
            <div>
              <strong>${escapeHtml(item.student_name)}</strong>
              <p>${escapeHtml(item.student_email)} - ${escapeHtml(item.class_name)}</p>
              <div class="item-actions">
                <button class="action-button danger-button remove-member" data-id="${escapeHtml(item.id)}" type="button">Keluarkan</button>
              </div>
            </div>
          </article>
        `).join("");
      }
    }
  }

  function applyRoleAccess() {
    const role = auth.user.role;
    els.resetData.classList.toggle("hidden", role === "student");
    els.seedDemo.classList.toggle("hidden", role === "student");

    document.body.classList.remove("teacher-mode", "student-mode", "admin-mode");

    // Securely render nav based on role
    let navHtml = "";
    if (role === "teacher") {
      navHtml = `
        <button class="nav-button" data-view="teacherView"><span aria-hidden="true">⌘</span> Assessment</button>
        <button class="nav-button" data-view="manageClassView"><span aria-hidden="true">👥</span> Kelas</button>
        <button class="nav-button" data-view="monitorView"><span aria-hidden="true">▤</span> Monitoring</button>
      `;
    } else if (role === "student") {
      navHtml = `
        <button class="nav-button" data-view="studentView"><span aria-hidden="true">◉</span> Kerjakan</button>
        <button class="nav-button" data-view="studentHistoryView"><span aria-hidden="true">🕒</span> Riwayat</button>
      `;
    } else if (role === "admin") {
      navHtml = `
        <button class="nav-button" data-view="observabilityView"><span aria-hidden="true">📈</span> Observabilitas</button>
        <button class="nav-button" id="adminNav" data-view="accountView"><span aria-hidden="true">ID</span> Akun</button>
      `;
    }
    els.mainNav.innerHTML = navHtml;

    if (role === "student") {
      document.body.classList.add("student-mode");
      switchView("studentView");
    } else if (role === "admin") {
      document.body.classList.add("admin-mode");
      switchView("observabilityView");
    } else {
      document.body.classList.add("teacher-mode");
      switchView("teacherView");
    }
  }

  function canAccessView(viewId) {
    if (!auth.user) return false;
    const role = auth.user.role;
    if (role === "student") return viewId === "studentView" || viewId === "studentHistoryView";
    if (role === "admin") return viewId === "accountView" || viewId === "monitorView" || viewId === "observabilityView";
    if (role === "teacher") return viewId === "teacherView" || viewId === "monitorView" || viewId === "manageClassView";
    return false;
  }

  function setNavVisibility(viewId, visible) {
    const button = [...els.navButtons].find((item) => item.dataset.view === viewId);
    if (button) button.classList.toggle("hidden", !visible);
  }

  async function saveCurrentAnswer() {
    const audio = await recorder.getAudioBase64();
    const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
    session.saveAnswer(els.answerText.value, audio, elapsed);
    recorder.clearAudio();
  }

  async function handleAssessmentSubmit(event) {
    event.preventDefault();
    const config = readAssessmentForm(els);
    if (!config.classId) {
      showToast("Pilih kelas tujuan terlebih dahulu.");
      return;
    }

    setButtonLoading(event.submitter, true, "Menghubungi AI...", "Generate assessment");
    try {
      const questions = await generateQuestionsWithFallback(config);
      pendingAssessmentConfig = config;
      pendingQuestions = questions;
      renderQuestionEditor();
    } finally {
      setButtonLoading(event.submitter, false, "Menghubungi AI...", "Generate assessment");
    }
  }

  async function savePendingQuestionSet() {
    if (!pendingAssessmentConfig) return;
    syncQuestionsFromEditor();
    const assessment = createAssessment(pendingAssessmentConfig, pendingQuestions);
    
    // Check if updating existing or saving new
    const existingIndex = state.assessments.findIndex(a => a.id === assessment.id);
    if (existingIndex >= 0) {
      await updateAssessment(assessment.id, assessment);
      state.assessments[existingIndex] = assessment;
    } else {
      await saveAssessmentToDatabase(assessment);
      state.assessments.unshift(assessment);
    }
    
    session.selectAssessment(assessment.id);
    pendingAssessmentConfig = null;
    pendingQuestions = [];
    els.form.reset();
    els.questionCount.value = DEFAULT_QUESTION_COUNT;
    renderCurrentState();
  }

  async function improvePendingQuestionSet() {
    if (!pendingAssessmentConfig) return;
    syncQuestionsFromEditor();
    setButtonLoading(els.improveQuestionSet, true, "Memperbaiki...", "Perbaiki dengan AI");
    try {
      pendingQuestions = await improveQuestionsWithAI(pendingAssessmentConfig, pendingQuestions);
      renderQuestionEditor();
    } catch (error) {
      showToast(error.message);
    } finally {
      setButtonLoading(els.improveQuestionSet, false, "Memperbaiki...", "Perbaiki dengan AI");
    }
  }

  function syncQuestionsFromEditor() {
    pendingQuestions = [...els.editableQuestionList.querySelectorAll(".editable-question")].map((item, index) => ({
      id: pendingQuestions[index]?.id || `q-${index}`,
      prompt: item.querySelector("[data-field='prompt']").value.trim(),
      focus: item.querySelector("[data-field='focus']").value.trim(),
      ideal: item.querySelector("[data-field='ideal']").value.trim(),
    }));
  }

  function renderQuestionEditor() {
    if (!pendingAssessmentConfig) {
      els.questionEditor.classList.add("hidden");
      els.editableQuestionList.innerHTML = "";
      return;
    }
    els.questionEditor.classList.remove("hidden");
    if (els.editDisableManualTyping) {
      els.editDisableManualTyping.checked = !!pendingAssessmentConfig.disableManualTyping;
    }
    if (els.editAllowRetakes) {
      els.editAllowRetakes.checked = !!pendingAssessmentConfig.allowRetakes;
    }
    els.editableQuestionList.innerHTML = pendingQuestions.map((question, index) => `
      <article class="feedback-card editable-question">
        <strong>Soal ${index + 1}</strong>
        <label>Pertanyaan<textarea data-field="prompt" rows="3">${escapeHtml(question.prompt)}</textarea></label>
        <label>Fokus<input data-field="focus" value="${escapeHtml(question.focus || "")}" /></label>
        <label>Jawaban ideal<textarea data-field="ideal" rows="3">${escapeHtml(question.ideal || "")}</textarea></label>
      </article>
    `).join("");
  }

  async function handleRecommendConfig() {
    await fillRecommendedFields("both");
  }

  async function fillRecommendedFields(target) {
    const topic = els.topic.value.trim();
    if (!topic) {
      showToast("Isi topik atau materi terlebih dahulu.");
      els.topic.focus();
      return;
    }

    const button = target === "rubric" ? els.recommendRubric : els.recommendOutcomes;
    const defaultText = target === "rubric" ? "Rekomendasikan rubrik" : "Rekomendasikan kompetensi";
    setButtonLoading(button, true, "Membuat rekomendasi...", defaultText);
    try {
      const recommendation = await recommendConfigWithFallback(topic, els.difficulty.value);
      if (target === "outcomes" || target === "both") els.outcomes.value = recommendation.outcomes;
      if (target === "rubric" || target === "both") els.rubric.value = recommendation.rubric;
    } finally {
      setButtonLoading(button, false, "Membuat rekomendasi...", defaultText);
    }
  }

  async function recommendConfigWithFallback(topic, difficulty) {
    try {
      return await recommendAssessmentConfig(topic, difficulty);
    } catch (error) {
      showToast(`AI belum tersedia, memakai rekomendasi lokal. Detail: ${error.message}`);
      return recommendFallbackConfig(topic, difficulty);
    }
  }

  async function generateQuestionsWithFallback(config) {
    try {
      return await generateQuestionsWithAI(config);
    } catch (error) {
      showToast(`AI belum tersedia, memakai generator lokal. Detail: ${error.message}`);
      return generateFallbackQuestions(config);
    }
  }

  async function handleFinishAssessment() {
    const assessment = session.getCurrentAssessment();
    if (!assessment) return;

    await saveCurrentAnswer();
    const studentName = auth.user.role === "student"
      ? auth.user.name
      : els.studentName.value.trim() || "Siswa tanpa nama";
    setButtonLoading(els.finishAssessment, true, "Menilai dengan AI...", "Selesaikan assessment");

    try {
      const submission = await evaluateWithFallback(assessment, studentName);
      await saveSubmissionToDatabase(submission);
      state.submissions.push(submission);
      renderMonitoring(els, state);
      renderStudentHistory(els, state.submissions, auth.user.name);
      showResult(els, submission, auth);
      if (auth.user.role === "student") {
        session.currentAssessmentId = null;
        renderCurrentState();
      }
    } catch (error) {
      import('./toast.js').then(({ showToast }) => showToast(`Gagal menyimpan hasil: ${error.message}`));
    } finally {
      setButtonLoading(els.finishAssessment, false, "Menilai dengan AI...", "Selesaikan assessment");
    }
  }

  async function evaluateWithFallback(assessment, studentName) {
    try {
      return await evaluateAssessmentWithAI(assessment, session.currentAnswers, studentName, createSubmission);
    } catch (error) {
      showToast(`AI belum tersedia, memakai penilaian lokal. Detail: ${error.message}`);
      return evaluateFallbackAssessment(assessment, session.currentAnswers, studentName, createSubmission);
    }
  }

  async function fetchAndRenderTelemetry() {
    try {
      const response = await fetch("/api/observability");
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal memuat data telemetry");
      }
      const data = await response.json();
      renderObservability(els, data);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function switchView(viewId) {
    if (!canAccessView(viewId)) return;
    const navBtns = els.mainNav.querySelectorAll(".nav-button");
    navBtns.forEach((button) => button.classList.toggle("active", button.dataset.view === viewId));
    els.views.forEach((view) => view.classList.toggle("active", view.id === viewId));
    if (viewId === "observabilityView") {
      fetchAndRenderTelemetry();
    }
  }



  let questionTimerInterval = null;
  let currentQuestionTimeLeft = 0;
  let questionStartTime = Date.now();

  function stopQuestionTimer() {
    if (questionTimerInterval) {
      clearInterval(questionTimerInterval);
      questionTimerInterval = null;
    }
    if (els.timerDisplay) els.timerDisplay.style.animation = "none";
  }

  function startQuestionTimer() {
    stopQuestionTimer();
    const assessment = session.getCurrentAssessment();
    if (!assessment || !assessment.timeLimit || assessment.timeLimit <= 0) {
      if (els.timerDisplay) els.timerDisplay.style.display = "none";
      if (els.recordButton) els.recordButton.disabled = false;
      if (els.answerText) els.answerText.disabled = false;
      return;
    }

    const currentAnswer = session.currentAnswers[session.currentQuestionIndex];
    if (!currentAnswer) return;

    if (currentAnswer.timeLeft === undefined) {
      currentAnswer.timeLeft = assessment.timeLimit;
    }

    currentQuestionTimeLeft = currentAnswer.timeLeft;

    if (currentQuestionTimeLeft <= 0) {
      if (els.timerDisplay) {
        els.timerDisplay.style.display = "inline-flex";
        els.timerDisplay.style.color = "var(--rose)";
        els.timerDisplay.style.borderColor = "var(--rose)";
        els.timerDisplay.innerHTML = `<strong>Waktu Habis</strong>`;
      }
      if (els.recordButton) els.recordButton.disabled = true;
      if (els.answerText) els.answerText.disabled = true;
      recorder.stop();
      return;
    }

    if (els.timerDisplay) {
      els.timerDisplay.style.display = "inline-flex";
      els.timerDisplay.style.color = "var(--rose)";
      els.timerDisplay.style.borderColor = "var(--rose)";
      els.timerDisplay.innerHTML = `<strong>${formatTime(currentQuestionTimeLeft)}</strong> tersisa`;
    }
    if (els.recordButton) els.recordButton.disabled = false;
    if (els.answerText) els.answerText.disabled = false;

    questionTimerInterval = setInterval(() => {
      currentQuestionTimeLeft--;
      currentAnswer.timeLeft = currentQuestionTimeLeft;

      if (currentQuestionTimeLeft <= 0) {
        stopQuestionTimer();
        handleTimeOut();
      } else {
        if (els.timerDisplay) {
          els.timerDisplay.innerHTML = `<strong>${formatTime(currentQuestionTimeLeft)}</strong> tersisa`;
          if (currentQuestionTimeLeft <= 10) {
            els.timerDisplay.style.animation = "pulseRed 1s infinite";
          }
        }
      }
    }, 1000);
  }

  async function handleTimeOut() {
    if (els.timerDisplay) els.timerDisplay.innerHTML = `<strong>Waktu Habis</strong>`;
    recorder.stop();
    if (els.recordButton) els.recordButton.disabled = true;
    if (els.answerText) els.answerText.disabled = true;
    showToast("Waktu habis! Jawaban disimpan secara otomatis.", "error");

    await new Promise((resolve) => setTimeout(resolve, 200));
    await saveCurrentAnswer();

    const assessment = session.getCurrentAssessment();
    if (!assessment) return;

    const isLastQuestion = session.currentQuestionIndex === assessment.questions.length - 1;
    if (isLastQuestion) {
      await handleFinishAssessment();
    } else {
      session.goNext();
      renderQuestion(els, assessment, session);
      recorder.resetStatus();
      try {
        await recorder.start();
      } catch (err) {
        console.warn("Could not start recorder:", err);
      }
      startQuestionTimer();
      questionStartTime = Date.now();
    }
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  async function handleCreateUser(event) {
    event.preventDefault();
    setButtonLoading(event.submitter, true, "Membuat akun...", "Buat akun");
    try {
      const user = await createUser({
        name: els.userName.value,
        email: els.userEmail.value,
        password: els.userPassword.value,
        role: els.userRole.value,
      });
      users.unshift(user);
      els.userForm.reset();
      renderUsers();
      refreshSimulatorIfEnabled();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setButtonLoading(event.submitter, false, "Membuat akun...", "Buat akun");
    }
  }

  async function handleCsvUpload(event) {
    event.preventDefault();
    const file = els.csvFile.files[0];
    if (!file) return;

    setButtonLoading(event.submitter, true, "Memproses...", "Upload & Proses CSV");
    
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      
      const payload = lines.map(line => {
        const [name, email, role, password] = line.split(",").map(item => item.trim());
        return { name, email, role, password };
      });

      if (payload.length === 0) {
        throw new Error("File CSV kosong atau format tidak valid");
      }

      const response = await createUsersBatch(payload);
      
      if (response.success && response.success.length > 0) {
        users.unshift(...response.success);
        renderUsers();
        refreshSimulatorIfEnabled();
      }
      
      const successCount = response.success ? response.success.length : 0;
      const errorCount = response.errors ? response.errors.length : 0;
      
      if (errorCount === 0) {
        showToast(`Berhasil membuat ${successCount} akun baru dari CSV.`, "success");
        els.csvForm.reset();
      } else {
        const errMsg = response.errors[0]?.message || "Beberapa baris gagal";
        showToast(`Selesai. Sukses: ${successCount}. Gagal: ${errorCount} (${errMsg})`, "error");
        els.csvForm.reset();
      }
    } catch (error) {
      showToast(error.message || "Gagal memproses file CSV", "error");
    } finally {
      setButtonLoading(event.submitter, false, "Memproses...", "Upload & Proses CSV");
    }
  }

  function bindEvents() {
    els.loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      setButtonLoading(event.submitter, true, "Login...", "Login");
      try {
        const nextAuth = await login({
          email: els.loginEmail.value,
          password: els.loginPassword.value,
        });
        await bootstrapAuthenticatedApp(nextAuth);
      } catch (error) {
        showToast(error.message);
      } finally {
        setButtonLoading(event.submitter, false, "Login...", "Login");
      }
    });

    els.registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      setButtonLoading(event.submitter, true, "Membuat tenant...", "Buat tenant");
      try {
        const nextAuth = await registerTenant({
          tenantName: els.registerTenant.value,
          name: els.registerName.value,
          email: els.registerEmail.value,
          password: els.registerPassword.value,
        });
        await bootstrapAuthenticatedApp(nextAuth);
      } catch (error) {
        showToast(error.message);
      } finally {
        setButtonLoading(event.submitter, false, "Membuat tenant...", "Buat tenant");
      }
    });

    els.logoutButton.addEventListener("click", async () => {
      await logout();
      auth = { authenticated: false };
      state = { assessments: [], submissions: [] };
      users = [];
      session = createSession(state);
      clearAuthForms();
      showAuth();
      refreshSimulatorIfEnabled();
    });

    els.mainNav.addEventListener("click", (e) => {
      const btn = e.target.closest(".nav-button");
      if (btn) switchView(btn.dataset.view);
    });

    if (els.studentClassFilter) {
      els.studentClassFilter.addEventListener("change", () => {
        renderCurrentState();
      });
    }

    if (els.monitorClassFilter) {
      els.monitorClassFilter.addEventListener("change", () => {
        renderCurrentState();
      });
    }

    els.form.addEventListener("submit", handleAssessmentSubmit);
    els.saveQuestionSet.addEventListener("click", savePendingQuestionSet);
    els.improveQuestionSet.addEventListener("click", improvePendingQuestionSet);
    if (els.editDisableManualTyping) {
      els.editDisableManualTyping.addEventListener("change", (e) => {
        if (pendingAssessmentConfig) {
          pendingAssessmentConfig.disableManualTyping = e.target.checked;
        }
      });
    }
    if (els.editAllowRetakes) {
      els.editAllowRetakes.addEventListener("change", (e) => {
        if (pendingAssessmentConfig) {
          pendingAssessmentConfig.allowRetakes = e.target.checked;
        }
      });
    }
    els.userForm.addEventListener("submit", handleCreateUser);
    els.csvForm.addEventListener("submit", handleCsvUpload);
    if (els.refreshTelemetryBtn) {
      els.refreshTelemetryBtn.addEventListener("click", () => {
        fetchAndRenderTelemetry();
        showToast("Telemetry data diperbarui", "success");
      });
    }
    els.recommendOutcomes.addEventListener("click", () => fillRecommendedFields("outcomes"));
    els.recommendRubric.addEventListener("click", () => fillRecommendedFields("rubric"));

    els.classForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = els.classNameInput.value.trim();
      if (!name) return;
      const classroom = await createClassroom(name);
      state.classes.unshift({ ...classroom, status: "teacher" });
      els.classForm.reset();
      renderCurrentState();
    });

    els.joinClassForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const code = els.joinCode.value.trim();
      if (!code) return;
      await joinClass(code);
      const nextState = await loadState();
      state.classes = nextState.classes;
      state.assessments = nextState.assessments;
      state.memberships = nextState.memberships;
      els.joinClassForm.reset();
      renderCurrentState();
      showToast("Request join terkirim. Tunggu approval guru.");
    });

    els.studentJoinClassForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const code = els.studentJoinCode.value.trim();
      if (!code) return;
      await joinClass(code);
      const nextState = await loadState();
      state.classes = nextState.classes;
      state.assessments = nextState.assessments;
      state.memberships = nextState.memberships;
      els.studentJoinClassForm.reset();
      renderCurrentState();
      showToast("Request join terkirim. Tunggu approval guru.");
    });

    els.pendingJoinList.addEventListener("click", async (event) => {
      const id = event.target.dataset.id;
      if (!id) return;
      if (event.target.classList.contains("approve-join")) {
        await approveJoinRequest(id);
      } else if (event.target.classList.contains("reject-join")) {
        await updateMembership(id, "rejected");
      } else return;
      
      const nextState = await loadState();
      state.classes = nextState.classes;
      state.memberships = nextState.memberships;
      state.assessments = nextState.assessments;
      renderCurrentState();
    });

    if (els.approvedMemberList) {
      els.approvedMemberList.addEventListener("click", async (event) => {
        const id = event.target.dataset.id;
        if (!id || !event.target.classList.contains("remove-member")) return;
        if (!confirm("Keluarkan siswa dari kelas ini?")) return;
        
        await deleteMembership(id);
        const nextState = await loadState();
        state.classes = nextState.classes;
        state.memberships = nextState.memberships;
        state.assessments = nextState.assessments;
        renderCurrentState();
      });
    }

    els.classList.addEventListener("click", async (event) => {
      const article = event.target.closest("article");
      if (!article) return;
      const id = article.dataset.id;
      
      if (event.target.classList.contains("edit-class")) {
        const currentName = state.classes.find(c => c.id === id)?.name || "";
        const newName = prompt("Nama kelas baru:", currentName);
        if (newName && newName !== currentName) {
          await updateClassroom(id, { name: newName });
          const nextState = await loadState();
          state.classes = nextState.classes;
          renderCurrentState();
        }
      } else if (event.target.classList.contains("delete-class")) {
        if (!confirm("Hapus kelas beserta semua datanya?")) return;
        await deleteClassroom(id);
        const nextState = await loadState();
        state.classes = nextState.classes;
        state.memberships = nextState.memberships;
        state.assessments = nextState.assessments;
        renderCurrentState();
      }
    });

    els.userList.addEventListener("click", async (event) => {
      const article = event.target.closest("article");
      if (!article) return;
      const id = article.dataset.id;
      
      if (event.target.classList.contains("edit-user")) {
        const currentUser = users.find(u => u.id === id);
        if (!currentUser) return;
        const newRole = prompt(`Ubah role untuk ${currentUser.name} (student/teacher/admin):`, currentUser.role);
        if (newRole && ["student", "teacher", "admin"].includes(newRole) && newRole !== currentUser.role) {
          await updateUser(id, { role: newRole });
          users = await loadUsers();
          renderUsers();
        } else if (newRole) {
          showToast("Role tidak valid. Harus student, teacher, atau admin.");
        }
      } else if (event.target.classList.contains("delete-user")) {
        if (!confirm("Hapus user ini?")) return;
        await deleteUser(id);
        users = await loadUsers();
        renderUsers();
      }
    });

    els.assessmentList.addEventListener("click", async (event) => {
      const article = event.target.closest("article");
      if (!article) return;
      const id = article.dataset.id;
      const assessment = state.assessments.find(a => a.id === id);
      if (!assessment) return;

      if (event.target.classList.contains("toggle-status-assessment")) {
        const nextStatus = assessment.status === "published" ? "closed" : "published";
        await updateAssessment(id, { status: nextStatus });
        assessment.status = nextStatus;
        renderCurrentState();
      } else if (event.target.classList.contains("delete-assessment")) {
        if (!confirm("Hapus assessment beserta semua submission?")) return;
        await deleteAssessment(id);
        const nextState = await loadState();
        state.assessments = nextState.assessments;
        state.submissions = nextState.submissions;
        renderCurrentState();
      } else if (event.target.classList.contains("edit-assessment")) {
        pendingAssessmentConfig = {
          id: assessment.id,
          topic: assessment.topic,
          difficulty: assessment.difficulty,
          classId: assessment.classId,
          outcomes: assessment.outcomes,
          rubric: assessment.rubric,
          disableManualTyping: !!assessment.disableManualTyping,
          allowRetakes: !!assessment.allowRetakes
        };
        pendingQuestions = assessment.questions;
        renderQuestionEditor();
        els.questionEditor.scrollIntoView({ behavior: 'smooth' });
      } else if (event.target.classList.contains("download-grades-assessment")) {
        const assessmentSubmissions = state.submissions.filter(s => s.assessmentId === id);
        if (!assessmentSubmissions.length) {
          showToast('Belum ada nilai/submission untuk assessment ini.', 'error');
          return;
        }

        const latestSubmissionsMap = new Map();
        assessmentSubmissions.forEach(sub => {
          const key = sub.studentName;
          const existing = latestSubmissionsMap.get(key);
          if (!existing || new Date(sub.submittedAt) > new Date(existing.submittedAt)) {
            latestSubmissionsMap.set(key, sub);
          }
        });

        const latestSubmissions = Array.from(latestSubmissionsMap.values());
        latestSubmissions.sort((a, b) => a.studentName.localeCompare(b.studentName));

        const escapeCsv = (val) => {
          if (val === null || val === undefined) return '';
          const str = String(val);
          if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };

        const csvRows = [];
        csvRows.push(['Nama Siswa', 'Email', 'Skor Akhir', 'Tanggal Pengerjaan'].map(escapeCsv).join(','));

        latestSubmissions.forEach(sub => {
          const membership = state.memberships.find(m => m.student_name === sub.studentName && m.class_id === assessment.classId);
          const email = membership ? (membership.student_email || '-') : '-';
          
          const formattedDate = sub.submittedAt 
            ? new Date(sub.submittedAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '-';

          csvRows.push([
            sub.studentName,
            email,
            sub.finalScore,
            formattedDate
          ].map(escapeCsv).join(','));
        });

        const csvContent = '\uFEFF' + 'sep=,\n' + csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        
        const safeTopicName = assessment.topic
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
        link.setAttribute("download", `nilai_${safeTopicName}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('CSV Nilai Assessment berhasil didownload.', 'success');
      }
    });

    if (els.studentAssessmentGrid) {
      els.studentAssessmentGrid.addEventListener("click", async (e) => {
        const btn = e.target.closest(".start-assessment-btn") || e.target.closest(".assessment-card");
        if (btn) {
          const assessment = state.assessments.find((item) => item.id === btn.dataset.id);
          if (assessment && isAssessmentLocked(assessment)) {
            showToast("Assessment ini sudah dikumpulkan dan tidak bisa dibuka lagi.");
            return;
          }

          recorder.stop();
          session.selectAssessment(btn.dataset.id);
          els.resultPanel.classList.add("hidden");
          renderCurrentState(); // This will trigger the toggle to workspace
          recorder.resetStatus();
          try {
            await recorder.start();
          } catch (err) {
            console.warn("Could not start recorder:", err);
          }
          startQuestionTimer();
          questionStartTime = Date.now();
        }
      });
    }

    if (els.backToDashboard) {
      els.backToDashboard.addEventListener("click", () => {
        recorder.stop();
        stopQuestionTimer();
        session.currentAssessmentId = null;
        renderCurrentState(); // Will hide workspace, show dashboard
      });
    }

    els.recordButton.addEventListener("click", () => {
      recorder.toggle().catch((error) => {
        els.recordStatus.textContent = error.message || "Mikrofon belum bisa digunakan. Ketik jawaban manual.";
        els.recordButton.classList.remove("recording");
        els.recordButton.disabled = false;
      });
    });

    els.prevQuestion.addEventListener("click", async () => {
      recorder.stop();
      await saveCurrentAnswer();
      session.goPrevious();
      renderQuestion(els, session.getCurrentAssessment(), session);
      recorder.resetStatus();
      try {
        await recorder.start();
      } catch (err) {
        console.warn("Could not start recorder:", err);
      }
      startQuestionTimer();
      questionStartTime = Date.now();
    });

    els.saveAnswer.addEventListener("click", async () => {
      recorder.stop();
      await saveCurrentAnswer();
      session.goNext();
      renderQuestion(els, session.getCurrentAssessment(), session);
      recorder.resetStatus();
      try {
        await recorder.start();
      } catch (err) {
        console.warn("Could not start recorder:", err);
      }
      startQuestionTimer();
      questionStartTime = Date.now();
    });

    els.finishAssessment.addEventListener("click", (e) => {
      stopQuestionTimer();
      handleFinishAssessment(e);
    });

    els.seedDemo.addEventListener("click", () => {
      if (state.assessments.length) return;
      const assessment = createDemoAssessment(generateFallbackQuestions);
      saveAssessmentToDatabase(assessment)
        .then(() => {
          state.assessments.push(assessment);
          renderCurrentState();
        })
        .catch((error) => showToast(`Gagal menyimpan contoh data: ${error.message}`));
    });

    els.resetData.addEventListener("click", async () => {
      if (!confirm("Reset semua assessment dan hasil?")) return;
      await clearDatabase();
      state.assessments = [];
      state.submissions = [];
      session.ensureAssessmentSelected();
      renderCurrentState();
      await refreshSimulatorIfEnabled();
    });

    // Simulator Panel toggle & close
    if (els.simulatorToggle) {
      els.simulatorToggle.addEventListener("click", () => {
        const isHidden = els.simulatorPanel.classList.toggle("hidden");
        els.simulatorToggle.setAttribute("aria-expanded", !isHidden);
        if (!isHidden) {
          refreshSimulatorIfEnabled();
        }
      });
    }

    if (els.simulatorClose) {
      els.simulatorClose.addEventListener("click", () => {
        els.simulatorPanel.classList.add("hidden");
        els.simulatorToggle.setAttribute("aria-expanded", "false");
      });
    }

    // Simulator Login Trigger
    if (els.simulatorTenantList) {
      els.simulatorTenantList.addEventListener("click", async (e) => {
        const loginBtn = e.target.closest(".simulator-login-btn:not(.active)");
        if (!loginBtn) return;
        const targetUserId = loginBtn.dataset.userId;
        if (!targetUserId) return;

        loginBtn.disabled = true;
        loginBtn.textContent = "Loading...";

        try {
          const nextAuth = await simulateLogin(targetUserId);
          showToast(`Berhasil masuk sebagai ${nextAuth.user.name} (${nextAuth.tenant.name})`, "success");
          
          // Re-bootstrap application
          await bootstrapAuthenticatedApp(nextAuth);
        } catch (error) {
          showToast(error.message, "error");
          loginBtn.disabled = false;
          loginBtn.textContent = "Masuk";
        }
      });
    }
  }

  function setupAdditionalEvents() {
    els.submissionList.addEventListener('click', (e) => {
      const viewBtn = e.target.closest('.view-submission-btn');
      if (!viewBtn) return;
      const item = viewBtn.closest('.submission-row');
      const submissionId = item.dataset.id;
      const submission = state.submissions.find(s => s.id === submissionId);
      if (submission) {
        showResult(els, submission, auth);
      }
    });

    els.studentHistoryList.addEventListener('click', (e) => {
      const viewBtn = e.target.closest('.view-submission-btn');
      if (!viewBtn) return;
      const item = viewBtn.closest('.submission-row');
      const submissionId = item.dataset.id;
      const submission = state.submissions.find(s => s.id === submissionId);
      if (submission) {
        showResult(els, submission, auth);
      }
    });

    els.resultPanel.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.edit-override-btn');
      if (!editBtn) return;
      const idx = parseInt(editBtn.dataset.index, 10);
      const submissionId = els.resultPanel.dataset.submissionId;
      const submission = state.submissions.find(s => s.id === submissionId);
      if (!submission) return;

      const qs = submission.questionScores[idx];
      const newScoreStr = prompt('Masukkan skor baru (0-100):', qs.score);
      if (newScoreStr === null) return;
      
      const scoreVal = parseInt(newScoreStr, 10);
      if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 100) {
        showToast('Skor tidak valid. Harus angka 0-100', 'error');
        return;
      }

      const newFeedback = prompt('Tambahkan / ubah catatan kelemahan (opsional):', qs.gaps?.join(' ') || '');
      if (newFeedback !== null) {
        qs.gaps = [newFeedback];
      }
      qs.score = scoreVal;
      
      submission.finalScore = Math.round(submission.questionScores.reduce((acc, curr) => acc + curr.score, 0) / submission.questionScores.length);
      
      try {
        await saveSubmissionToDatabase(submission);
        showToast('Koreksi berhasil disimpan', 'success');
        showResult(els, submission, auth);
        renderMonitoring(els, state);
      renderStudentHistory(els, state.submissions, auth.user.name);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    if (els.downloadClassCsvBtn) {
      els.downloadClassCsvBtn.addEventListener('click', () => {
        const classId = els.monitorClassFilter?.value;
        if (!classId) {
          showToast('Pilih kelas terlebih dahulu untuk download nilai.', 'error');
          return;
        }

        const selectedClass = state.classes.find(c => c.id === classId);
        const className = selectedClass ? selectedClass.name : 'Kelas';

        const classSubmissions = state.submissions.filter(s => s.classId === classId);
        if (!classSubmissions.length) {
          showToast('Belum ada nilai/submission di kelas ini.', 'error');
          return;
        }

        const latestSubmissionsMap = new Map();
        classSubmissions.forEach(sub => {
          const key = `${sub.studentName}_${sub.assessmentId}`;
          const existing = latestSubmissionsMap.get(key);
          if (!existing || new Date(sub.submittedAt) > new Date(existing.submittedAt)) {
            latestSubmissionsMap.set(key, sub);
          }
        });

        const latestSubmissions = Array.from(latestSubmissionsMap.values());

        latestSubmissions.sort((a, b) => {
          const nameCompare = a.studentName.localeCompare(b.studentName);
          if (nameCompare !== 0) return nameCompare;
          return a.assessmentTitle.localeCompare(b.assessmentTitle);
        });

        const escapeCsv = (val) => {
          if (val === null || val === undefined) return '';
          const str = String(val);
          if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };

        const csvRows = [];
        csvRows.push(['Nama Siswa', 'Email', 'Topik Assessment', 'Skor Akhir', 'Tanggal Pengerjaan'].map(escapeCsv).join(','));

        latestSubmissions.forEach(sub => {
          const membership = state.memberships.find(m => m.student_name === sub.studentName && m.class_id === classId);
          const email = membership ? (membership.student_email || '-') : '-';
          
          const formattedDate = sub.submittedAt 
            ? new Date(sub.submittedAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '-';

          csvRows.push([
            sub.studentName,
            email,
            sub.assessmentTitle,
            sub.finalScore,
            formattedDate
          ].map(escapeCsv).join(','));
        });

        const csvContent = '\uFEFF' + 'sep=,\n' + csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        
        const safeClassName = className
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
        link.setAttribute("download", `nilai_${safeClassName}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('CSV berhasil didownload.', 'success');
      });
    }
  }

  async function refreshSimulatorIfEnabled() {
    if (!els.simulatorWidget) return;
    try {
      const data = await getSimulationData();
      els.simulatorWidget.classList.remove("hidden");
      renderSimulator(data);
    } catch (error) {
      els.simulatorWidget.classList.add("hidden");
    }
  }

  async function refreshSimulator() {
    try {
      const data = await getSimulationData();
      renderSimulator(data);
    } catch (error) {
      console.error("Gagal memuat data simulator:", error);
      if (els.simulatorTenantList) {
        els.simulatorTenantList.innerHTML = `<div class="empty-state">Gagal memuat tenant: ${escapeHtml(error.message)}</div>`;
      }
    }
  }

  function renderSimulator(data) {
    if (!els.simulatorTenantList) return;
    const { tenants, users: allUsers } = data;
    if (!tenants || !tenants.length) {
      els.simulatorTenantList.innerHTML = `<div class="empty-state">Belum ada tenant.</div>`;
      return;
    }

    // Group users by tenant_id
    const usersByTenant = {};
    allUsers.forEach(u => {
      const tId = u.tenantId || u.tenant_id;
      if (!usersByTenant[tId]) usersByTenant[tId] = [];
      usersByTenant[tId].push(u);
    });

    els.simulatorTenantList.innerHTML = tenants.map(t => {
      const tUsers = usersByTenant[t.id] || [];
      const userRows = tUsers.map(u => {
        const isActive = auth && auth.authenticated && auth.user && auth.user.id === u.id;
        const roleClass = `simulator-role-${u.role}`;
        return `
          <div class="simulator-user-row ${isActive ? 'active' : ''}">
            <div class="simulator-user-info">
              <span class="simulator-user-name">${escapeHtml(u.name)}</span>
              <span class="simulator-user-detail">${escapeHtml(u.email)}</span>
              <span class="simulator-user-role-badge ${roleClass}">${escapeHtml(roleLabel(u.role))}</span>
            </div>
            ${isActive 
              ? `<span class="simulator-login-btn active" style="background: var(--emerald); color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">Aktif</span>` 
              : `<button class="simulator-login-btn" data-user-id="${escapeHtml(u.id)}" type="button">Masuk</button>`
            }
          </div>
        `;
      }).join("");

      return `
        <div class="simulator-tenant-group">
          <div class="simulator-tenant-name">${escapeHtml(t.name)}</div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${userRows.length ? userRows : '<p style="font-size: 0.75rem; color: var(--muted); margin: 0;">Tidak ada akun</p>'}
          </div>
        </div>
      `;
    }).join("");
  }

  refreshSimulatorIfEnabled();

  bindEvents();
  setupAdditionalEvents();
  if (auth.authenticated) {
    await bootstrapAuthenticatedApp(auth);
  } else {
    showAuth();
  }
}

function roleLabel(role) {
  return {
    admin: "Admin",
    teacher: "Guru",
    student: "Siswa",
  }[role] || role;
}
