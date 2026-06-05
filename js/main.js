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
} from "./api.js";
import { createAssessment, createDemoAssessment, createSubmission, readAssessmentForm } from "./assessment-factory.js";
import { getElements, setButtonLoading } from "./dom.js";
import { evaluateFallbackAssessment, generateFallbackQuestions, recommendFallbackConfig } from "./fallback-assessment.js";
import { createRecorder } from "./recorder.js";
import { renderApp, renderMonitoring, renderStudentHistory, renderQuestion, showResult } from "./render.js";
import { createSession } from "./session.js";
import { loadState } from "./storage.js";

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

  function renderCurrentState() {
    if (auth.user?.role !== "student") {
      session.ensureAssessmentSelected();
    } else {
      if (session.currentAssessmentId && !state.assessments.some((a) => a.id === session.currentAssessmentId)) {
        session.currentAssessmentId = null;
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
          <strong>${user.name}</strong>
          <p>${user.email}</p>
          <div class="item-actions">
            <button type="button" class="action-button edit-user">Ubah Role</button>
            <button type="button" class="action-button danger-button delete-user">Hapus</button>
          </div>
        </div>
        <span class="user-role">${roleLabel(user.role)}</span>
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
      ? usableClasses.map((item) => `<option value="${item.id}">${item.name}</option>`).join("")
      : `<option value="">Belum ada kelas</option>`;

    if (els.monitorClassFilter && !isStudent) {
      const currentVal = els.monitorClassFilter.value;
      els.monitorClassFilter.innerHTML = `<option value="">Semua Kelas</option>` +
        state.classes.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
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
        <article class="submission-item" data-id="${item.id}">
          <div style="flex: 1; min-width: 0;">
            <strong>${item.name}</strong>
            <p>Kode: ${item.join_code || item.joinCode || "-"} - ${item.status}</p>
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
              <strong>${item.name}</strong>
              <p>Status: ${item.status === 'approved' ? 'Disetujui' : 'Menunggu'}</p>
            </div>
          </article>
        `).join("");
      }

      if (els.studentClassFilter) {
        const approvedClasses = activeClasses.filter(c => c.status === "approved");
        const currentVal = els.studentClassFilter.value;
        els.studentClassFilter.innerHTML = `<option value="">Semua Kelas</option>` +
          approvedClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
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
            <strong>${item.student_name}</strong>
            <p>${item.student_email} - ${item.class_name}</p>
          </div>
          <div class="item-actions">
            <button class="secondary-button approve-join" data-id="${item.id}" type="button">Approve</button>
            <button class="action-button danger-button reject-join" data-id="${item.id}" type="button">Tolak</button>
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
              <strong>${item.student_name}</strong>
              <p>${item.student_email} - ${item.class_name}</p>
              <div class="item-actions">
                <button class="action-button danger-button remove-member" data-id="${item.id}" type="button">Keluarkan</button>
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
        <button class="nav-button" id="adminNav" data-view="accountView"><span aria-hidden="true">ID</span> Akun</button>
      `;
    }
    els.mainNav.innerHTML = navHtml;

    if (role === "student") {
      document.body.classList.add("student-mode");
      switchView("studentView");
    } else if (role === "admin") {
      document.body.classList.add("admin-mode");
      switchView("accountView");
    } else {
      document.body.classList.add("teacher-mode");
      switchView("teacherView");
    }
  }

  function canAccessView(viewId) {
    if (!auth.user) return false;
    const role = auth.user.role;
    if (role === "student") return viewId === "studentView" || viewId === "studentHistoryView";
    if (role === "admin") return viewId === "accountView" || viewId === "monitorView";
    if (role === "teacher") return viewId === "teacherView" || viewId === "monitorView" || viewId === "manageClassView";
    return false;
  }

  function setNavVisibility(viewId, visible) {
    const button = [...els.navButtons].find((item) => item.dataset.view === viewId);
    if (button) button.classList.toggle("hidden", !visible);
  }

  async function saveCurrentAnswer() {
    const audio = await recorder.getAudioBase64();
    session.saveAnswer(els.answerText.value, audio);
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
    els.editableQuestionList.innerHTML = pendingQuestions.map((question, index) => `
      <article class="feedback-card editable-question">
        <strong>Soal ${index + 1}</strong>
        <label>Pertanyaan<textarea data-field="prompt" rows="3">${question.prompt}</textarea></label>
        <label>Fokus<input data-field="focus" value="${question.focus || ""}" /></label>
        <label>Jawaban ideal<textarea data-field="ideal" rows="3">${question.ideal || ""}</textarea></label>
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

  function switchView(viewId) {
    if (!canAccessView(viewId)) return;
    const navBtns = els.mainNav.querySelectorAll(".nav-button");
    navBtns.forEach((button) => button.classList.toggle("active", button.dataset.view === viewId));
    els.views.forEach((view) => view.classList.toggle("active", view.id === viewId));
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
    } catch (error) {
      showToast(error.message);
    } finally {
      setButtonLoading(event.submitter, false, "Membuat akun...", "Buat akun");
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
    els.userForm.addEventListener("submit", handleCreateUser);
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
          rubric: assessment.rubric
        };
        pendingQuestions = assessment.questions;
        renderQuestionEditor();
        els.questionEditor.scrollIntoView({ behavior: 'smooth' });
      }
    });

    if (els.studentAssessmentGrid) {
      els.studentAssessmentGrid.addEventListener("click", (e) => {
        const btn = e.target.closest(".start-assessment-btn") || e.target.closest(".assessment-card");
        if (btn) {
          recorder.stop();
          session.selectAssessment(btn.dataset.id);
          els.resultPanel.classList.add("hidden");
          renderCurrentState(); // This will trigger the toggle to workspace
          recorder.resetStatus();
        }
      });
    }

    if (els.backToDashboard) {
      els.backToDashboard.addEventListener("click", () => {
        recorder.stop();
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
    });

    els.saveAnswer.addEventListener("click", async () => {
      recorder.stop();
      await saveCurrentAnswer();
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
        .catch((error) => showToast(`Gagal menyimpan contoh data: ${error.message}`));
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
  }

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
