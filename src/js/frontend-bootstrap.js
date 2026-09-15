import { createSession } from "./session.js";
import { loadState } from "./storage.js";
import { listUsers } from "./api.js";
import { renderApp, renderStudentHistory } from "./render.js";
import { showToast } from "./toast.js";
import { clearAuthForms, isAssessmentLocked } from "./app-context.js";

export async function bootstrapCoreApp(ctx, auth) {
  ctx.auth = auth;
  ctx.state = await loadState();
  ctx.session = createSession(ctx.state);
  ctx.users = ctx.auth.user.role === "admin" ? await loadUsers() : [];
  clearAuthForms(ctx);
}

async function loadUsers() {
  try {
    return await listUsers();
  } catch (error) {
    showToast(`Gagal memuat user tenant: ${error.message}`);
    return [];
  }
}

export async function renderRoleState(ctx, modules = {}) {
  const { els, auth, session, state } = ctx;

  if (auth.user?.role !== "student") {
    session.ensureAssessmentSelected();
  } else {
    if (
      session.currentAssessmentId &&
      !state.assessments.some((assessment) => assessment.id === session.currentAssessmentId)
    ) {
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

  if (auth.user) {
    renderStudentHistory(els, state.submissions, auth.user.name);
  }

  const role = auth.user?.role;

  if (role === "teacher") {
    modules.classManagement?.renderClasses(ctx);
    modules.assessmentWizard?.renderQuestionEditor(ctx);
    modules.complaints?.renderComplaints(ctx);
    modules.complaints?.updateComplaintBadge(ctx);
  } else if (role === "student") {
    modules.complaints?.notifyStudentComplaintStatus(ctx);
  }

  const hasData = state.assessments.length > 0;
  const isDev =
    window.ENABLE_DEMO_SIMULATION === "true" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost";

  document
    .querySelectorAll(".sidebar-settings")
    .forEach((element) => element.classList.toggle("hidden", !isDev));

  if (els.seedDemoTeacher) els.seedDemoTeacher.classList.toggle("hidden", hasData);
  if (els.seedDemoAdmin) els.seedDemoAdmin.classList.toggle("hidden", hasData);
  if (els.seedDemo) els.seedDemo.classList.toggle("hidden", hasData);
  if (els.removeDemoData) {
    els.removeDemoData.classList.toggle("hidden", role === "student" || !hasData);
  }

  if (role === "student") {
    els.studentName.value = auth.user.name;
    els.studentName.readOnly = true;
    if (session.getCurrentAssessment()?.oralExamEnabled === false) {
      ctx.recorder.setEnabled(false);
    }
  } else {
    els.studentName.readOnly = false;
  }
}
