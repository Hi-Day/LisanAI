import { getElements } from "./dom.js";
import { createSession } from "./session.js";
import { createRecorder } from "./recorder.js";
import { loadState } from "./storage.js";
import { listUsers, getSimulationData } from "./api.js";
import { renderApp, renderStudentHistory } from "./render.js";
import { showToast } from "./toast.js";
import { escapeHtml, roleLabel } from "./utils.js";

/**
 * Central mutable application state shared across feature modules.
 * Each feature module receives this context and mutates it directly,
 * avoiding the need to thread dozens of parameters through call sites.
 */
export function createAppContext() {
  const els = getElements();
  const recorder = createRecorder({
    recordButton: els.recordButton,
    recordStatus: els.recordStatus,
    answerText: els.answerText,
    recordTimer: els.recordTimer,
    volumeIndicator: els.volumeIndicator,
  });

  return {
    els,
    recorder,
    auth: null,
    state: { assessments: [], submissions: [], classes: [], memberships: [] },
    users: [],
    session: null,
    pendingAssessmentConfig: null,
    pendingQuestions: [],
    isEvaluating: false,
    lastModalTrigger: null,
    micCheck: null,
    pendingExamAssessmentId: null,
    preExamTrigger: null,
    isStartingExam: false,
    currentWizardStep: 1,
    memberSearchQuery: "",
    memberCurrentPage: 1,
    MEMBERS_PER_PAGE: 10,
    questionTimerInterval: null,
    currentQuestionTimeLeft: 0,
    questionStartTime: Date.now(),
    currentViewId: null,
  };
}

export async function bootstrapAuthenticatedApp(ctx, nextAuth) {
  ctx.auth = nextAuth;
  const isAdmin = ctx.auth.user.role === "admin";
  const [state, users] = await Promise.all([
    loadState(),
    isAdmin ? loadUsers(ctx) : Promise.resolve([]),
  ]);
  ctx.state = state;
  ctx.users = users;
  ctx.session = createSession(ctx.state);
  clearAuthForms(ctx);
  showApp(ctx);
  applyRoleAccess(ctx);
  await renderCurrentState(ctx);
  const [{ renderUsers }] = await Promise.all([
    import("./user-management.js"),
  ]);
  renderUsers(ctx);
  refreshSimulatorIfEnabled(ctx);
}

export async function loadUsers(ctx) {
  try {
    return await listUsers();
  } catch (error) {
    showToast(`Gagal memuat user tenant: ${error.message}`);
    return [];
  }
}

export function showAuth(ctx) {
  const { els } = ctx;
  els.authView.classList.remove("hidden");
  els.appShell.classList.add("hidden");
  closeRegisterModal(ctx);
  closeResultModal(ctx);
}

export function showApp(ctx) {
  const { els, auth } = ctx;
  els.authView.classList.add("hidden");
  els.appShell.classList.remove("hidden");
  closeRegisterModal(ctx);
  els.accountName.textContent = auth.user.name;
  els.tenantName.textContent = auth.tenant.name;
  els.accountRole.textContent = roleLabel(auth.user.role);
}

export function clearAuthForms(ctx) {
  ctx.els.loginForm.reset();
  ctx.els.registerForm.reset();
}

export function openRegisterModal(ctx) {
  const { els } = ctx;
  if (els.registerModal) {
    ctx.lastModalTrigger = document.activeElement;
    els.registerModal.classList.remove("hidden");
    if (els.registerTenant) els.registerTenant.focus();
  }
}

export function closeRegisterModal(ctx) {
  const { els } = ctx;
  if (els.registerModal) {
    els.registerModal.classList.add("hidden");
    if (ctx.lastModalTrigger instanceof HTMLElement && document.contains(ctx.lastModalTrigger)) ctx.lastModalTrigger.focus();
    ctx.lastModalTrigger = null;
  }
}

export function closeResultModal(ctx) {
  const { els } = ctx;
  if (!els.resultPanel || els.resultPanel.classList.contains("hidden")) return;
  els.resultPanel.classList.add("hidden");
  const returnFocus = els.resultPanel._returnFocus;
  if (returnFocus instanceof HTMLElement && document.contains(returnFocus)) returnFocus.focus();
}

export function trapFocus(event, modal) {
  const focusable = [...modal.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter((element) => !element.closest(".hidden"));
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function handleModalKeyboard(ctx, event) {
  const { els } = ctx;
  const registerOpen = els.registerModal && !els.registerModal.classList.contains("hidden");
  const resultOpen = els.resultPanel && !els.resultPanel.classList.contains("hidden");
  if (!registerOpen && !resultOpen) return;
  if (event.key === "Escape") {
    event.preventDefault();
    if (resultOpen) closeResultModal(ctx);
    else closeRegisterModal(ctx);
    return;
  }
  if (event.key === "Tab") trapFocus(event, resultOpen ? els.resultPanel : els.registerModal);
}

export function isAssessmentLocked(ctx, assessment) {
  if (!assessment) return false;
  if (assessment.status === "closed") return true;
  const studentSubmissions = ctx.state.submissions.filter((submission) => submission.assessmentId === assessment.id);
  const used = studentSubmissions.length;
  if (assessment.allowRetakes) return false;
  const maxAttempts = Number(assessment.maxAttempts) || 1;
  return used >= maxAttempts;
}

export async function renderCurrentState(ctx) {
  const { els, auth, session, state } = ctx;
  if (auth.user?.role !== "student") {
    session.ensureAssessmentSelected();
  } else {
    if (session.currentAssessmentId && !state.assessments.some((a) => a.id === session.currentAssessmentId)) {
      session.currentAssessmentId = null;
    }
    const currentAssessment = session.getCurrentAssessment();
    if (currentAssessment && isAssessmentLocked(ctx, currentAssessment)) {
      session.currentAssessmentId = null;
      session.currentAnswers = [];
      session.currentQuestionIndex = 0;
    }
  }
  renderApp(els, state, session);
  if (auth.user) renderStudentHistory(els, state.submissions, auth.user.name);
  const { renderClasses } = await import("./class-management.js");
  const { renderQuestionEditor } = await import("./assessment-wizard.js");
  renderClasses(ctx);
  renderQuestionEditor(ctx);

  const { renderComplaints, updateComplaintBadge, notifyStudentComplaintStatus } = await import("./complaints.js");
  if (auth.user?.role === "teacher") {
    renderComplaints(ctx);
    updateComplaintBadge(ctx);
  } else if (auth.user?.role === "student") {
    notifyStudentComplaintStatus(ctx);
  }

  const hasData = state.assessments.length > 0;
  const isDev = window.ENABLE_DEMO_SIMULATION === "true" || window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
  const devTools = document.querySelectorAll(".sidebar-settings");
  devTools.forEach((el) => el.classList.toggle("hidden", !isDev));

  if (els.seedDemoTeacher) els.seedDemoTeacher.classList.toggle("hidden", hasData);
  if (els.seedDemoAdmin) els.seedDemoAdmin.classList.toggle("hidden", hasData);
  if (els.seedDemo) els.seedDemo.classList.toggle("hidden", hasData);
  if (els.removeDemoData) els.removeDemoData.classList.toggle("hidden", auth.user?.role === "student" || !hasData);

  if (auth.user?.role === "student") {
    els.studentName.value = auth.user.name;
    els.studentName.readOnly = true;
    if (session.getCurrentAssessment()?.oralExamEnabled === false) ctx.recorder.setEnabled(false);
  } else {
    els.studentName.readOnly = false;
  }
}

export function applyRoleAccess(ctx) {
  const { els, auth } = ctx;
  const role = auth.user.role;
  if (els.seedDemo) els.seedDemo.classList.toggle("hidden", role === "student");
  if (els.seedDemoTeacher) els.seedDemoTeacher.classList.toggle("hidden", role === "student");
  if (els.seedDemoAdmin) els.seedDemoAdmin.classList.toggle("hidden", role !== "admin");
  if (els.removeDemoData) els.removeDemoData.classList.toggle("hidden", role === "student");
  document.body.classList.remove("teacher-mode", "student-mode", "admin-mode");
