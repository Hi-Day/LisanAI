import { getElements } from "./dom.js";
import { createSession } from "./session.js";
import { createRecorder } from "./recorder.js";
import { loadState } from "./storage.js";
import { listUsers, getSimulationData } from "./api.js";
import { renderApp, renderStudentHistory, renderObservability } from "./render.js";
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
    currentWizardStep: 1,
    // Pagination state for members
    memberSearchQuery: "",
    memberCurrentPage: 1,
    MEMBERS_PER_PAGE: 10,
    // Question timer state
    questionTimerInterval: null,
    currentQuestionTimeLeft: 0,
    questionStartTime: Date.now(),
  };
}

export async function bootstrapAuthenticatedApp(ctx, nextAuth) {
  ctx.auth = nextAuth;
  ctx.state = await loadState();
  ctx.session = createSession(ctx.state);
  ctx.users = ctx.auth.user.role === "admin" ? await loadUsers(ctx) : [];
  clearAuthForms(ctx);
  showApp(ctx);
  applyRoleAccess(ctx);
  await renderCurrentState(ctx);
  // Dynamic import breaks the circular dependency (user-management imports from this file).
  const { renderUsers } = await import("./user-management.js");
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
    if (els.registerTenant) {
      els.registerTenant.focus();
    }
  }
}

export function closeRegisterModal(ctx) {
  const { els } = ctx;
  if (els.registerModal) {
    els.registerModal.classList.add("hidden");
    if (ctx.lastModalTrigger instanceof HTMLElement && document.contains(ctx.lastModalTrigger)) {
      ctx.lastModalTrigger.focus();
    }
    ctx.lastModalTrigger = null;
  }
}

export function closeResultModal(ctx) {
  const { els } = ctx;
  if (!els.resultPanel || els.resultPanel.classList.contains("hidden")) return;
  els.resultPanel.classList.add("hidden");
  const returnFocus = els.resultPanel._returnFocus;
  if (returnFocus instanceof HTMLElement && document.contains(returnFocus)) {
    returnFocus.focus();
  }
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
  // Dynamic imports break the circular dependency: these feature modules
  // import renderCurrentState from this file.
  const { renderClasses } = await import("./class-management.js");
  const { renderQuestionEditor } = await import("./assessment-wizard.js");
  renderClasses(ctx);
  renderQuestionEditor(ctx);

  // Complaint UI: teacher badge + centralized list, student status notification.
  const { renderComplaints, updateComplaintBadge, notifyStudentComplaintStatus } = await import("./complaints.js");
  if (auth.user?.role === "teacher") {
    renderComplaints(ctx);
    updateComplaintBadge(ctx);
  } else if (auth.user?.role === "student") {
    notifyStudentComplaintStatus(ctx);
  }

  // Hide the "Isi data contoh" button once there is at least one assessment.
  if (els.seedDemo) {
    els.seedDemo.classList.toggle("hidden", state.assessments.length > 0);
  }

  if (auth.user?.role === "student") {
    els.studentName.value = auth.user.name;
    els.studentName.readOnly = true;
    if (session.getCurrentAssessment()?.oralExamEnabled === false) {
      ctx.recorder.setEnabled(false);
    }
  } else {
    els.studentName.readOnly = false;
  }
}

export function applyRoleAccess(ctx) {
  const { els, auth } = ctx;
  const role = auth.user.role;
  els.resetData.classList.toggle("hidden", role === "student");
  els.seedDemo.classList.toggle("hidden", role === "student");

  document.body.classList.remove("teacher-mode", "student-mode", "admin-mode");

  let navHtml = "";
  if (role === "teacher") {
    navHtml = `
      <button class="nav-button" data-view="dashboardView"><span aria-hidden="true">▦</span> Dashboard</button>
      <div class="nav-group">
        <button class="nav-button" data-view="assessmentListView" aria-haspopup="true" aria-expanded="false">
          <span aria-hidden="true">⌘</span> Penilaian <span class="nav-caret" aria-hidden="true">▾</span>
        </button>
        <div class="nav-sub hidden">
          <button class="nav-sub-item" data-nav-assessment-tab="all">Semua Penilaian</button>
          <button class="nav-sub-item" data-nav-assessment-tab="draft">Draft</button>
          <button class="nav-sub-item" data-nav-assessment-tab="published">Published</button>
          <button class="nav-sub-item" data-nav-view="teacherView">Buat Penilaian</button>
        </div>
      </div>
      <button class="nav-button" data-view="manageClassView"><span aria-hidden="true">👥</span> Kelas</button>
      <button class="nav-button" data-view="studentProfileView"><span aria-hidden="true">◉</span> Siswa</button>
      <button class="nav-button" data-view="monitorView"><span aria-hidden="true">▤</span> Monitoring</button>
      <button class="nav-button" data-view="complaintView">
        <span aria-hidden="true">📩</span> Komplain
        <span id="complaintNavBadge" class="nav-badge hidden">0</span>
      </button>
    `;
  } else if (role === "student") {
    navHtml = `
      <button class="nav-button" data-view="studentView"><span aria-hidden="true">◉</span> Kerjakan</button>
      <button class="nav-button" data-view="studentHistoryView"><span aria-hidden="true">🕒</span> Riwayat</button>
      <button class="nav-button" data-view="studentNotifView"><span aria-hidden="true">📩</span> Notifikasi</button>
    `;
  } else if (role === "admin") {
    navHtml = `
      <button class="nav-button" data-view="observabilityView"><span aria-hidden="true">📈</span> Observabilitas</button>
      <button class="nav-button" data-view="researchView"><span aria-hidden="true">🧪</span> Riset</button>
      <button class="nav-button" id="adminNav" data-view="accountView"><span aria-hidden="true">👤</span> Akun</button>
      <button class="nav-button" data-view="apiKeysView"><span aria-hidden="true">🔑</span> API Keys</button>
    `;
  }
  els.mainNav.innerHTML = navHtml;

  // Penilaian submenu: expand/collapse + tab filtering.
  const penulisGroup = els.mainNav.querySelector(".nav-group");
  penulisGroup?.querySelector(".nav-button")?.addEventListener("click", (e) => {
    e.preventDefault();
    const open = !penulisGroup.classList.contains("open");
    penulisGroup.classList.toggle("open", open);
    penulisGroup.querySelector(".nav-button")?.setAttribute("aria-expanded", String(open));
  });
  els.mainNav.querySelectorAll("[data-nav-assessment-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setAssessmentTab(ctx, btn.dataset.navAssessmentTab);
      switchView(ctx, "assessmentListView");
    });
  });
  els.mainNav.querySelectorAll("[data-nav-view]").forEach((btn) => {
    btn.addEventListener("click", () => switchView(ctx, btn.dataset.navView));
  });

  if (role === "student") {
    document.body.classList.add("student-mode");
    switchView(ctx, "studentView");
  } else if (role === "admin") {
    document.body.classList.add("admin-mode");
    switchView(ctx, "observabilityView");
  } else {
    document.body.classList.add("teacher-mode");
    switchView(ctx, "dashboardView");
  }
}

export function setAssessmentTab(ctx, tab) {
  const { els } = ctx;
  if (!els.assessmentTabFilter) return;
  els.assessmentTabFilter.querySelectorAll(".tab-filter-btn").forEach((b) => {
    const active = b.dataset.tab === tab;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", String(active));
  });
}

export function canAccessView(ctx, viewId) {
  if (!ctx.auth.user) return false;
  const role = ctx.auth.user.role;
  if (role === "student") return viewId === "studentView" || viewId === "studentHistoryView" || viewId === "studentNotifView";
  if (role === "admin") return viewId === "accountView" || viewId === "monitorView" || viewId === "observabilityView" || viewId === "apiKeysView" || viewId === "researchView";
  if (role === "teacher") {
    return [
      "dashboardView", "teacherView", "assessmentListView", "assessmentDetailView",
      "monitorView", "manageClassView", "studentProfileView", "complaintView",
    ].includes(viewId);
  }
  return false;
}

export async function switchView(ctx, viewId) {
  if (!canAccessView(ctx, viewId)) return;
  const { els } = ctx;
  const navBtns = els.mainNav.querySelectorAll(".nav-button");
  navBtns.forEach((button) => button.classList.toggle("active", button.dataset.view === viewId));
  els.views.forEach((view) => view.classList.toggle("active", view.id === viewId));
  if (viewId === "dashboardView") {
    const { renderDashboard } = await import("./dashboard.js");
    renderDashboard(ctx);
  }
  if (viewId === "assessmentListView") {
    const { renderAssessmentsWithTab } = await import("./dashboard.js");
    renderAssessmentsWithTab(ctx);
  }
  if (viewId === "studentProfileView") {
    const { renderStudentProfile } = await import("./dashboard.js");
    populateProfileSelect(ctx);
    const names = [...new Set(ctx.state.submissions.map((s) => s.studentName))];
    if (names.length) {
      const selected = ctx.profileSelectedStudent || names[0];
      els.profileStudentSelect.value = selected;
      renderStudentProfile(ctx, selected);
    } else {
      els.studentProfileContent.innerHTML =
        '<div class="analytics-panel"><div class="empty-state">Belum ada siswa dengan penilaian. Data akan muncul setelah siswa mengumpulkan penilaian.</div></div>';
    }
  }
  if (viewId === "observabilityView") {
    fetchAndRenderTelemetry(ctx);
  }
  if (viewId === "researchView") {
    const { loadResearch } = await import("./research.js");
    loadResearch(ctx);
  }
  if (viewId === "apiKeysView") {
    const { loadApiKeys } = await import("./api-keys.js");
    loadApiKeys(ctx);
  }
}

function populateProfileSelect(ctx) {
  const { els } = ctx;
  if (!els.profileStudentSelect) return;
  const names = [...new Set(ctx.state.submissions.map((s) => s.studentName))].sort((a, b) => a.localeCompare(b));
  const options = names.map((n) => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
  if (els.profileStudentSelect.innerHTML !== options) {
    els.profileStudentSelect.innerHTML = options;
  }
}

export async function fetchAndRenderTelemetry(ctx) {
  const { els } = ctx;
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

export async function refreshSimulatorIfEnabled(ctx) {
  const { els } = ctx;
  if (!els.simulatorWidget) return;
  try {
    const data = await getSimulationData();
    els.simulatorWidget.classList.remove("hidden");
    renderSimulator(ctx, data);
  } catch (error) {
    els.simulatorWidget.classList.add("hidden");
  }
}

export async function refreshSimulator(ctx) {
  const { els } = ctx;
  try {
    const data = await getSimulationData();
    renderSimulator(ctx, data);
  } catch (error) {
    console.error("Gagal memuat data simulator:", error);
    if (els.simulatorTenantList) {
      els.simulatorTenantList.innerHTML = `<div class="empty-state">Gagal memuat tenant: ${escapeHtml(error.message)}</div>`;
    }
  }
}

export function renderSimulator(ctx, data) {
  const { els, auth } = ctx;
  if (!els.simulatorTenantList) return;
  const { tenants, users: allUsers } = data;
  if (!tenants || !tenants.length) {
    els.simulatorTenantList.innerHTML = `<div class="empty-state">Belum ada tenant.</div>`;
    return;
  }

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

export { roleLabel };