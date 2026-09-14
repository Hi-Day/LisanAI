import { getCurrentUser } from "./api.js";
import { createAppContext, bootstrapAuthenticatedApp, showAuth, switchView, refreshSimulatorIfEnabled } from "./app-context.js";
import { bindAuthEvents } from "./auth-ui.js";

/**
 * Load feature modules only after authentication is known. The authenticated
 * bootstrap and feature downloads run in parallel so the app does not pay the
 * cost of every feature module before the first authenticated render.
 */
async function loadAuthenticatedFeatures() {
  const [
    assessmentWizard,
    assessmentUx,
    studentFlow,
    classManagement,
    userManagement,
    simulator,
    monitoring,
    demoData,
    complaints,
    apiKeys,
    research,
    observability,
    dashboard,
    questionBank,
    notifications,
  ] = await Promise.all([
    import("./assessment-wizard.js"),
    import("./assessment-ux.js"),
    import("./student-flow.js"),
    import("./class-management.js"),
    import("./user-management.js"),
    import("./simulator.js"),
    import("./monitoring.js"),
    import("./demo-data.js"),
    import("./complaints.js"),
    import("./api-keys.js"),
    import("./research.js"),
    import("./observability.js"),
    import("./dashboard.js"),
    import("./question-bank.js"),
    import("./notifications.js"),
  ]);

  return {
    bind(ctx) {
      assessmentWizard.bindAssessmentWizardEvents(ctx);
      assessmentUx.enhanceAssessmentWizardUX(ctx);
      studentFlow.bindStudentFlowEvents(ctx);
      classManagement.bindClassManagementEvents(ctx);
      userManagement.bindUserManagementEvents(ctx);
      simulator.bindSimulatorEvents(ctx);
      monitoring.bindMonitoringEvents(ctx);
      demoData.bindDemoDataEvents(ctx);
      complaints.bindComplaintEvents(ctx);
      apiKeys.bindApiKeyEvents(ctx);
      research.bindResearchEvents(ctx);
      observability.bindObservabilityEvents(ctx);
      dashboard.bindDashboardEvents(ctx);
      questionBank.bindQuestionBankEvents(ctx);

      if (ctx.auth.authenticated && ["admin", "teacher"].includes(ctx.auth.user.role)) {
        notifications.startNotificationListener(ctx);
      }
    },
  };
}

/**
 * Application entry point. Creates the shared context, authenticates, and
 * lazily loads authenticated feature modules without changing feature APIs.
 */
export async function initApp() {
  const ctx = createAppContext();
  ctx.auth = await getCurrentUser();

  // Authentication is the only feature module required before we know whether
  // the user needs the full application bundle.
  bindAuthEvents(ctx);

  const authenticated = ctx.auth.authenticated;
  const bootstrapPromise = authenticated
    ? bootstrapAuthenticatedApp(ctx, ctx.auth)
    : Promise.resolve();
  const featuresPromise = authenticated
    ? loadAuthenticatedFeatures()
    : Promise.resolve(null);

  // Bootstrap data/rendering and feature downloads happen concurrently.
  const [features] = await Promise.all([featuresPromise, bootstrapPromise]);
  if (features) features.bind(ctx);

  // Navigation
  ctx.els.mainNav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-button");
    if (btn) switchView(ctx, btn.dataset.view);
  });

  // Browser/Android Back navigation for the SPA. View changes create history
  // entries in app-context.js; popstate only renders the already-selected entry.
  window.addEventListener("popstate", () => {
    if (!ctx.auth?.authenticated) return;
    const viewId = history.state?.lisanView;
    if (viewId) switchView(ctx, viewId, { fromHistory: true });
  });

  // Student filter tabs (tryout/assessment toggle)
  document.addEventListener("click", async (e) => {
    const filterBtn = e.target.closest("[data-student-filter]");
    if (filterBtn) {
      document.querySelectorAll("[data-student-filter]").forEach((b) => {
        b.classList.toggle("active", b === filterBtn);
      });
      const { renderStudentArea } = await import("./render.js");
      renderStudentArea(ctx.els, ctx.state, ctx.session);
      return;
    }
  });

  // Global handler for data-nav-view buttons (e.g. wizard "Import dari Bank Soal").
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-nav-view]");
    if (btn) switchView(ctx, btn.dataset.navView);
  });

  // Global "more-menu" close behavior (shared across views).
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

  // Dark mode toggle
  // Explicitly manage BOTH .light-mode and .dark-mode so the OS-preference
  // media query (:root:not(.light-mode):not(.dark-mode)) never fights the
  // user's explicit choice.
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

  // Hamburger menu for mobile
  if (ctx.els.hamburgerBtn) {
    ctx.els.hamburgerBtn.addEventListener("click", () => {
      const sidebar = document.querySelector(".sidebar");
      sidebar.classList.toggle("nav-open");
      ctx.els.hamburgerBtn.classList.toggle("open");
      ctx.els.hamburgerBtn.setAttribute("aria-expanded",
        sidebar.classList.contains("nav-open") ? "true" : "false");
    });
    // Close nav on nav click (mobile)
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

  if (!authenticated) showAuth(ctx);
}
