import("/js/learning-outcome-trend.js").catch(() => {});import("/js/submission-feedback.js").then(m=>m.installSubmissionFeedback()).catch(()=>{});import("/js/pedagogical-gate.js").catch(()=>{});import("/js/assessment-outcomes-ux.js").catch(()=>{});import("/js/assessment-outcomes-ai.js").catch(()=>{});
(function enhanceAssessmentWizardUX() {
  function apply() {
    const form = document.getElementById("assessmentForm");
    const panel = form?.querySelector('[data-wizard-panel="1"]');
    if (!form || !panel || panel.dataset.uxEnhanced === "1") return;
    const classLabel = document.getElementById("classSelect")?.closest("label");
    const countLabel = document.getElementById("questionCount")?.closest("label");
    const difficultyLabel = document.getElementById("difficulty")?.closest("label");
    const timeLimitLabel = document.getElementById("timeLimit")?.closest("label");
    const attemptsLabel = document.getElementById("maxAttempts")?.closest("label");
    const examplesLabel = document.getElementById("examples")?.closest("label");
    const checks = panel.querySelector(":scope > .wizard-checks");
    const classRow = classLabel?.parentElement?.classList.contains("form-row-2") ? classLabel.parentElement : null;
    const countRow = countLabel?.parentElement?.classList.contains("form-row-2") ? countLabel.parentElement : null;
    if (!classLabel || !countLabel || !difficultyLabel || !timeLimitLabel || !attemptsLabel) return;
    const coreGrid = document.createElement("div");
    coreGrid.className = "assessment-core-grid";
    coreGrid.setAttribute("aria-label", "Pengaturan utama penilaian");
    classLabel.remove(); countLabel.remove(); coreGrid.append(classLabel, countLabel);
    const outcomesLabel = document.getElementById("outcomes")?.closest("label");
    outcomesLabel?.after(coreGrid);
    if (classRow) classRow.remove();
    if (countRow && countRow !== classRow) countRow.remove();
    const advanced = document.createElement("details");
    advanced.className = "assessment-advanced-settings";
    const summary = document.createElement("summary"); summary.textContent = "⚙ Pengaturan lanjutan";
    const hint = document.createElement("p"); hint.className = "assessment-advanced-hint"; hint.textContent = "Gunakan bila perlu. Pengaturan utama di atas sudah cukup untuk membuat penilaian.";
    const body = document.createElement("div"); body.className = "assessment-advanced-body";
    advanced.append(summary, hint, body);
    [difficultyLabel, timeLimitLabel, attemptsLabel, checks, examplesLabel].forEach((node) => { if (node) body.appendChild(node); });
    panel.appendChild(advanced); panel.dataset.uxEnhanced = "1";
  }
  function start() {
    apply();
    if (!document.getElementById("assessmentForm")?.querySelector('[data-wizard-panel="1"]')) requestAnimationFrame(start);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();

(function installLisanUIPolish() {
  const style = document.createElement("style");
  style.id = "lisan-ui-polish";
  style.textContent = "\n    #probingGatePanel { margin: 0 0 20px; }\n    #probingGatePanel.is-empty { display: none; }\n    .probing-gate-panel { border: 1px solid var(--line); border-radius: 16px; background: var(--panel); box-shadow: var(--shadow-subtle); overflow: hidden; }\n    .probing-gate-heading { padding: 18px 20px; }\n    .probing-gate-heading h3 { margin: 0 0 5px; }\n    .probing-gate-heading p { margin: 0; color: var(--muted); line-height: 1.5; }\n    .probing-gate-list-wrap { padding: 0 20px 20px; }\n    @keyframes lisanSmoothCaret { 0%, 42% { opacity: 1; } 50%, 92% { opacity: 0.2; } 100% { opacity: 1; } }\n    @keyframes lisanSmoothShimmer { 0% { background-position: 180% 0; } 100% { background-position: -80% 0; } }\n    @keyframes lisanSmoothSpin { to { transform: rotate(360deg); } }\n    .probing-caret, .probing-stream-caret { animation: lisanSmoothCaret 1.8s ease-in-out infinite !important; }\n    .skeleton, .ai-skeleton-card { animation: lisanSmoothShimmer 2.8s ease-in-out infinite !important; }\n    .ai-stream-spinner, .loading-spinner, .spinner, .button-spinner, .evaluation-spinner { animation: lisanSmoothSpin 1.8s linear infinite !important; }\n    .recording-indicator, .record-button.recording::before, .record-button.recording::after { animation-duration: 1.8s !important; animation-timing-function: ease-in-out !important; }\n    .fade-in, .fadeIn { animation-duration: 0.45s !important; animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1) !important; }\n    @media (prefers-reduced-motion: reduce) { #probingGatePanel *, .skeleton, .ai-skeleton-card { animation: none !important; } }\n  ";
  document.head.appendChild(style);
})();

import {
  applyRoleAccess,
  clearAuthForms,
  closeRegisterModal,
  createAppContext,
  createSession,
  handleModalKeyboard,
  isAssessmentLocked,
  openLaunchTarget,
  openRegisterModal,
  refreshSimulatorIfEnabled,
  showApp,
  showAuth,
  switchView
} from "./chunks/chunk-N4EC4ZXY.js";
import {
  loadState
} from "./chunks/chunk-PKDFY347.js";
import {
  showToast
} from "./chunks/chunk-5RMC4JHK.js";
import {
  getCurrentUser,
  listUsers,
  login,
  logout,
  registerTenant
} from "./chunks/chunk-TUODA4CJ.js";
import {
  renderApp,
  renderStudentHistory
} from "./chunks/chunk-5COPEVEC.js";
import "./chunks/chunk-5AH2L77E.js";
import "./chunks/chunk-3BDSMFGS.js";
import {
  setButtonLoading
} from "./chunks/chunk-VS2E6D4X.js";
import "./chunks/chunk-3EIGNEHM.js";

// src/js/auth-ui.js
function bindAuthEvents(ctx) {
  const { els } = ctx;
  document.addEventListener("keydown", (event) => handleModalKeyboard(ctx, event));
  if (els.openRegisterModalBtn) {
    els.openRegisterModalBtn.addEventListener("click", () => openRegisterModal(ctx));
  }
  if (els.closeRegisterModalBtn) {
    els.closeRegisterModalBtn.addEventListener("click", () => closeRegisterModal(ctx));
  }
  if (els.registerModal) {
    els.registerModal.addEventListener("click", (event) => {
      if (event.target === els.registerModal) {
        closeRegisterModal(ctx);
      }
    });
  }
  els.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setButtonLoading(event.submitter, true, "Login...", "Login");
    try {
      const nextAuth = await login({
        email: els.loginEmail.value,
        password: els.loginPassword.value
      });
      await ctx.onAuthenticated?.(nextAuth);
    } catch (error) {
      console.error("Login error:", error);
      showToast(error.message || "Login gagal");
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
        password: els.registerPassword.value
      });
      closeRegisterModal(ctx);
      await ctx.onAuthenticated?.(nextAuth);
    } catch (error) {
      showToast(error.message);
    } finally {
      setButtonLoading(event.submitter, false, "Membuat tenant...", "Buat tenant");
    }
  });
  if (els.registerPassword) {
    els.registerPassword.addEventListener("input", () => {
      const val = els.registerPassword.value;
      const bars = document.querySelectorAll("#registerPasswordStrength .password-strength-bar");
      const label = document.getElementById("registerPasswordStrengthLabel");
      if (!bars.length) return;
      let score = 0;
      if (val.length >= 8) score += 1;
      if (/[a-z]/.test(val) && /[A-Z]/.test(val)) score += 1;
      if (/\d/.test(val)) score += 1;
      if (/[^a-zA-Z0-9]/.test(val)) score += 1;
      const level = val.length === 0 ? -1 : score <= 1 ? 0 : score <= 2 ? 1 : 2;
      const levels = ["weak", "medium", "strong"];
      const labels = ["", "Lemah", "Sedang", "Kuat"];
      bars.forEach((bar, i) => {
        bar.className = "password-strength-bar" + (i <= level && level >= 0 ? " " + levels[level] : "");
      });
      if (label) {
        label.textContent = level >= 0 ? labels[level + 1] : "";
        label.className = "password-strength-label" + (level >= 0 ? " " + levels[level] : "");
      }
    });
  }
  els.logoutButton.addEventListener("click", async () => {
    await logout();
    ctx.auth = { authenticated: false };
    ctx.state = { assessments: [], submissions: [], classes: [], memberships: [] };
    ctx.users = [];
    ctx.session = null;
    ctx.features = null;
    clearAuthForms(ctx);
    showAuth(ctx);
    const { refreshSimulatorIfEnabled: refreshSimulatorIfEnabled2 } = await import("./chunks/app-context-RLTTNXWC.js");
    refreshSimulatorIfEnabled2(ctx);
  });
}

// src/js/frontend-bootstrap.js
async function bootstrapCoreApp(ctx, auth) {
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
async function renderRoleState(ctx, modules = {}) {
  const { els, auth, session, state } = ctx;
  if (auth.user?.role !== "student") {
    session.ensureAssessmentSelected();
  } else {
    if (session.currentAssessmentId && !state.assessments.some((assessment) => assessment.id === session.currentAssessmentId)) {
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
    modules.scoreValidation?.renderScoreValidation(ctx);
  } else if (role === "student") {
    modules.studentClassManagement?.renderStudentClasses(ctx);
    modules.studentComplaints?.notifyStudentComplaintStatus(ctx);
  }
  const hasData = state.assessments.length > 0;
  const isDev = window.ENABLE_DEMO_SIMULATION === "true" || window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
  document.querySelectorAll(".sidebar-settings").forEach((element) => element.classList.toggle("hidden", !isDev));
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

// src/js/main.js
var ROLE_FEATURES = {
  student: {
    studentFlow: () => import("./chunks/student-flow-KQLD7JV4.js"),
    studentClassManagement: () => import("./chunks/student-class-management-YWEP23TY.js"),
    studentComplaints: () => import("./chunks/student-complaints-GDS3NX64.js"),
    studentComplaintActions: () => import("./chunks/student-complaint-actions-4GXXZV6N.js"),
    resultModal: () => import("./chunks/result-modal-7ZPWWDQM.js")
  },
  teacher: {
    complaints: () => import("./chunks/complaints-ZWCRKC43.js"),
    scoreValidation: () => import("./chunks/score-validation-WETXYNB5.js"),
    assessmentWizard: () => import("./chunks/assessment-wizard-HB6MMWD7.js"),
    assessmentUx: () => import("./chunks/assessment-ux-NBOVU3CX.js"),
    classManagement: () => import("./chunks/class-management-YOBX2LF6.js"),
    monitoring: () => import("./chunks/monitoring-JQBB6IRR.js"),
    demoData: () => import("./chunks/demo-data-FT4VGG6H.js"),
    dashboard: () => import("./chunks/dashboard-AQH3HHHT.js"),
    questionBank: () => import("./chunks/question-bank-EJWGSC6D.js"),
    notifications: () => import("./chunks/notifications-I6GGFLN3.js"),
    simulator: () => import("./chunks/simulator-HYYWYCBV.js"),
    resultModal: () => import("./chunks/result-modal-7ZPWWDQM.js")
  },
  admin: {
    userManagement: () => import("./chunks/user-management-NSAKYK42.js"),
    monitoring: () => import("./chunks/monitoring-JQBB6IRR.js"),
    apiKeys: () => import("./chunks/api-keys-AUL56CMA.js"),
    research: () => import("./chunks/research-E7F4G7JV.js"),
    researchLab: () => import("./chunks/research-lab-S47BPCEW.js"),
    observability: () => import("./chunks/observability-E4W6NGLW.js"),
    questionBank: () => import("./chunks/question-bank-EJWGSC6D.js"),
    notifications: () => import("./chunks/notifications-I6GGFLN3.js"),
    simulator: () => import("./chunks/simulator-HYYWYCBV.js"),
    resultModal: () => import("./chunks/result-modal-7ZPWWDQM.js")
  }
};
async function loadAuthenticatedFeatures(role) {
  const factories = ROLE_FEATURES[role] || {};
  const loaded = await Promise.all(
    Object.entries(factories).map(async ([name, load]) => [name, await load()])
  );
  return Object.fromEntries(loaded);
}
function bindTeacherFeatures(ctx, modules) {
  modules.assessmentWizard?.bindAssessmentWizardEvents(ctx);
  modules.assessmentUx?.enhanceAssessmentWizardUX(ctx);
  modules.classManagement?.bindClassManagementEvents(ctx);
  modules.monitoring?.bindMonitoringEvents(ctx);
  modules.scoreValidation?.bindScoreValidationEvents(ctx);
  modules.demoData?.bindDemoDataEvents(ctx);
  modules.dashboard?.bindDashboardEvents(ctx);
  modules.questionBank?.bindQuestionBankEvents(ctx);
  modules.notifications?.startNotificationListener(ctx);
  modules.simulator?.bindSimulatorEvents(ctx);
}
function bindAdminFeatures(ctx, modules) {
  modules.userManagement?.bindUserManagementEvents(ctx);
  modules.monitoring?.bindMonitoringEvents(ctx);
  modules.apiKeys?.bindApiKeyEvents(ctx);
  modules.research?.bindResearchEvents(ctx);
  modules.researchLab?.bindResearchLabEvents(ctx);
  modules.observability?.bindObservabilityEvents(ctx);
  modules.questionBank?.bindQuestionBankEvents(ctx);
  modules.notifications?.startNotificationListener(ctx);
  modules.simulator?.bindSimulatorEvents(ctx);
}
function bindStudentFeatures(ctx, modules) {
  modules.studentFlow?.bindStudentFlowEvents(ctx);
  modules.studentClassManagement?.bindStudentClassManagementEvents(ctx);
  modules.studentComplaintActions?.bindStudentComplaintActions(ctx);
}
function bindAuthenticatedFeatures(ctx, modules) {
  const role = ctx.auth.user.role;
  if (role === "teacher") {
    modules.complaints?.bindComplaintEvents(ctx);
  }
  modules.resultModal?.bindResultModalEvents(ctx);
  if (role === "teacher") bindTeacherFeatures(ctx, modules);
  else if (role === "admin") bindAdminFeatures(ctx, modules);
  else if (role === "student") bindStudentFeatures(ctx, modules);
}
function bindGlobalNavigation(ctx) {
  ctx.els.mainNav.addEventListener("click", (event) => {
    const button = event.target.closest(".nav-button");
    if (button) void switchView(ctx, button.dataset.view);
  });
  window.addEventListener("popstate", () => {
    if (!ctx.auth?.authenticated) return;
    const viewId = history.state?.lisanView;
    if (viewId) void switchView(ctx, viewId, { fromHistory: true });
  });
  document.addEventListener("click", async (event) => {
    const filterButton = event.target.closest("[data-student-filter]");
    if (!filterButton) return;
    document.querySelectorAll("[data-student-filter]").forEach((button) => {
      button.classList.toggle("active", button === filterButton);
    });
    const { renderStudentArea } = await import("./chunks/render-JJGHTRNB.js");
    renderStudentArea(ctx.els, ctx.state, ctx.session);
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-nav-view]");
    if (button) void switchView(ctx, button.dataset.navView);
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest(".more-menu")) return;
    document.querySelectorAll(".more-menu-dropdown:not(.hidden)").forEach((dropdown) => {
      dropdown.classList.add("hidden");
      const trigger = dropdown.closest(".more-menu")?.querySelector(".more-menu-trigger");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
    });
  });
}
function bindThemeControls(ctx) {
  const savedTheme = localStorage.getItem("lisan-theme");
  const applyTheme = (theme) => {
    const root = document.documentElement;
    root.classList.toggle("dark-mode", theme === "dark");
    root.classList.toggle("light-mode", theme === "light");
    localStorage.setItem("lisan-theme", theme);
    if (ctx.els.darkModeToggle) {
      ctx.els.darkModeToggle.innerHTML = theme === "dark" ? '<span aria-hidden="true">\u2600\uFE0F</span><span>Mode Terang</span>' : '<span aria-hidden="true">\u{1F319}</span><span>Mode Gelap</span>';
    }
  };
  if (savedTheme === "dark") applyTheme("dark");
  else if (savedTheme === "light") applyTheme("light");
  ctx.els.darkModeToggle?.addEventListener("click", () => {
    const isDark = document.documentElement.classList.contains("dark-mode");
    applyTheme(isDark ? "light" : "dark");
  });
}
function bindMobileNavigation(ctx) {
  if (!ctx.els.hamburgerBtn) return;
  ctx.els.hamburgerBtn.addEventListener("click", () => {
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar) return;
    sidebar.classList.toggle("nav-open");
    ctx.els.hamburgerBtn.classList.toggle("open");
    ctx.els.hamburgerBtn.setAttribute(
      "aria-expanded",
      sidebar.classList.contains("nav-open") ? "true" : "false"
    );
  });
  document.querySelector(".sidebar")?.addEventListener("click", (event) => {
    if (!(event.target.closest(".nav-button") || event.target.closest(".nav-sub-item"))) return;
    if (window.innerWidth > 900) return;
    document.querySelector(".sidebar")?.classList.remove("nav-open");
    ctx.els.hamburgerBtn.classList.remove("open");
    ctx.els.hamburgerBtn.setAttribute("aria-expanded", "false");
  });
}
async function bootstrapAuthenticated(ctx, nextAuth) {
  const launchHash = window.location.hash;
  try {
    const featuresPromise = loadAuthenticatedFeatures(nextAuth.user.role);
    await bootstrapCoreApp(ctx, nextAuth);
    const features = await featuresPromise;
    ctx.features = features;
    await applyRoleAccess(ctx);
    await renderRoleState(ctx, features);
    bindAuthenticatedFeatures(ctx, features);
    if (nextAuth.user.role === "admin") {
      features.userManagement?.renderUsers(ctx);
    }
    await refreshSimulatorIfEnabled(ctx);
    showApp(ctx);
    await openLaunchTarget(ctx, launchHash);
  } catch (error) {
    console.error("Authenticated bootstrap failed:", error);
    ctx.features = null;
    showAuth(ctx);
    throw error;
  }
}
async function initApp() {
  const ctx = createAppContext();
  ctx.auth = await getCurrentUser();
  ctx.onAuthenticated = (nextAuth) => bootstrapAuthenticated(ctx, nextAuth);
  bindAuthEvents(ctx);
  if (!ctx.auth.authenticated) {
    showAuth(ctx);
    bindGlobalNavigation(ctx);
    bindThemeControls(ctx);
    bindMobileNavigation(ctx);
    return;
  }
  await bootstrapAuthenticated(ctx, ctx.auth);
  bindGlobalNavigation(ctx);
  bindThemeControls(ctx);
  bindMobileNavigation(ctx);
}
document.addEventListener("invalid", (event) => {
  const field = event.target;
  if (field.validity?.valueMissing) field.setCustomValidity("Kolom ini wajib diisi.");
  else if (field.validity?.typeMismatch && field.type === "email") field.setCustomValidity("Masukkan alamat email yang valid.");
}, true);
document.addEventListener("input", (event) => event.target.setCustomValidity?.(""), true);
document.addEventListener("click", (event) => {
  if (event.target.closest("#dashboardCreateAssessment")) document.querySelector('.nav-sub-item[data-nav-view="teacherView"]')?.click();
});

// src/js/app.js
initApp().catch((error) => {
  console.error(error);
  alert(`Aplikasi gagal dijalankan: ${error.message}`);
});
//# sourceMappingURL=app.bundle.js.map
