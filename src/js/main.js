import { getCurrentUser } from "./api.js";
import { createAppContext, bootstrapAuthenticatedApp, showAuth, switchView, refreshSimulatorIfEnabled } from "./app-context.js";
import { bindAuthEvents } from "./auth-ui.js";

async function loadAuthenticatedFeatures(role) {
  const imports = {
    assessmentWizard: import("./assessment-wizard.js"),
    assessmentUx: import("./assessment-ux.js"),
    complaints: import("./complaints.js"),
    simulator: import("./simulator.js"),
  };
  if (role === "teacher") {
    Object.assign(imports, {
      studentFlow: import("./student-flow.js"),
      classManagement: import("./class-management.js"),
      monitoring: import("./monitoring.js"),
      demoData: import("./demo-data.js"),
      dashboard: import("./dashboard.js"),
      questionBank: import("./question-bank.js"),
      notifications: import("./notifications.js"),
    });
  } else if (role === "admin") {
    Object.assign(imports, {
      userManagement: import("./user-management.js"),
      monitoring: import("./monitoring.js"),
      apiKeys: import("./api-keys.js"),
      research: import("./research.js"),
      observability: import("./observability.js"),
      questionBank: import("./question-bank.js"),
      notifications: import("./notifications.js"),
    });
  } else if (role === "student") {
    Object.assign(imports, { studentFlow: import("./student-flow.js") });
  }
  const loaded = await Promise.all(Object.entries(imports).map(async ([name, promise]) => [name, await promise]));
  return Object.fromEntries(loaded);
}

function bindAuthenticatedFeatures(ctx, modules) {
  modules.assessmentWizard?.bindAssessmentWizardEvents(ctx);
  modules.assessmentUx?.enhanceAssessmentWizardUX(ctx);
  modules.complaints?.bindComplaintEvents(ctx);
  modules.simulator?.bindSimulatorEvents(ctx);
  if (ctx.auth.user.role === "teacher") {
    modules.studentFlow?.bindStudentFlowEvents(ctx);
    modules.classManagement?.bindClassManagementEvents(ctx);
    modules.monitoring?.bindMonitoringEvents(ctx);
    modules.demoData?.bindDemoDataEvents(ctx);
    modules.dashboard?.bindDashboardEvents(ctx);
    modules.questionBank?.bindQuestionBankEvents(ctx);
    modules.notifications?.startNotificationListener(ctx);
  } else if (ctx.auth.user.role === "admin") {
    modules.userManagement?.bindUserManagementEvents(ctx);
    modules.monitoring?.bindMonitoringEvents(ctx);
    modules.apiKeys?.bindApiKeyEvents(ctx);
    modules.research?.bindResearchEvents(ctx);
    modules.observability?.bindObservabilityEvents(ctx);
    modules.questionBank?.bindQuestionBankEvents(ctx);
    modules.notifications?.startNotificationListener(ctx);
  } else if (ctx.auth.user.role === "student") {
    modules.studentFlow?.bindStudentFlowEvents(ctx);
  }
}

export async function initApp() {
  const ctx = createAppContext();
  ctx.auth = await getCurrentUser();
  bindAuthEvents(ctx);

  if (!ctx.auth.authenticated) {
    showAuth(ctx);
  } else {
    // Feature handlers must exist before bootstrap exposes the authenticated UI.
    // bootstrap renders/replaces view content and tests/users can interact as
    // soon as the app shell becomes visible. Modules are downloaded in parallel
    // before binding, while bootstrap itself still performs the data/render work.
    const features = await loadAuthenticatedFeatures(ctx.auth.user.role);
    bindAuthenticatedFeatures(ctx, features);
    await bootstrapAuthenticatedApp(ctx, ctx.auth);
  }

  ctx.els.mainNav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-button");
    if (btn) switchView(ctx, btn.dataset.view);
  });

  window.addEventListener("popstate", () => {
    if (!ctx.auth?.authenticated) return;
    const viewId = history.state?.lisanView;
    if (viewId) switchView(ctx, viewId, { fromHistory: true });
  });

  document.addEventListener("click", async (e) => {
    const filterBtn = e.target.closest("[data-student-filter]");
    if (filterBtn) {
      document.querySelectorAll("[data-student-filter]").forEach((b) => b.classList.toggle("active", b === filterBtn));
      const { renderStudentArea } = await import("./render.js");
      renderStudentArea(ctx.els, ctx.state, ctx.session);
    }
  });

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-nav-view]");
    if (btn) switchView(ctx, btn.dataset.navView);
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".more-menu")) {
      document.querySelectorAll(".more-menu-dropdown:not(.hidden)").forEach((d) => {
        d.classList.add("hidden");
        const trigger = d.closest(".more-menu")?.querySelector(".more-menu-trigger");
        if (trigger) trigger.setAttribute("aria-expanded", "false");
      });
    }
  });

  refreshSimulatorIfEnabled(ctx);

  const savedTheme = localStorage.getItem("lisan-theme");
  const applyTheme = (theme) => {
    const root = document.documentElement;
    root.classList.toggle("dark-mode", theme === "dark");
    root.classList.toggle("light-mode", theme === "light");
    localStorage.setItem("lisan-theme", theme);
    if (ctx.els.darkModeToggle) {
      ctx.els.darkModeToggle.innerHTML = theme === "dark"
        ? '<span aria-hidden="true">☀️</span><span>Mode Terang</span>'
        : '<span aria-hidden="true">🌙</span><span>Mode Gelap</span>';
    }
  };
  if (savedTheme === "dark") applyTheme("dark");
  else if (savedTheme === "light") applyTheme("light");
  if (ctx.els.darkModeToggle) {
    ctx.els.darkModeToggle.addEventListener("click", () => {
      const isDark = document.documentElement.classList.contains("dark-mode");
      applyTheme(isDark ? "light" : "dark");
    });
  }

  if (ctx.els.hamburgerBtn) {
    ctx.els.hamburgerBtn.addEventListener("click", () => {
      const sidebar = document.querySelector(".sidebar");
      sidebar.classList.toggle("nav-open");
      ctx.els.hamburgerBtn.classList.toggle("open");
      ctx.els.hamburgerBtn.setAttribute("aria-expanded", sidebar.classList.contains("nav-open") ? "true" : "false");
    });
    document.querySelector(".sidebar")?.addEventListener("click", (e) => {
      if (e.target.closest(".nav-button") || e.target.closest(".nav-sub-item")) {
        if (window.innerWidth <= 900) {
          document.querySelector(".sidebar").classList.remove("nav-open");
          ctx.els.hamburgerBtn.classList.remove("open");
          ctx.els.hamburgerBtn.setAttribute("aria-expanded", "false");
        }
      }
    });
  }
}
