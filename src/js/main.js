import { getCurrentUser } from "./api.js";
import { createAppContext, bootstrapAuthenticatedApp, showAuth, switchView } from "./app-context.js";
import { bindAuthEvents } from "./auth-ui.js";
import { bindAssessmentWizardEvents } from "./assessment-wizard.js";
import { bindStudentFlowEvents } from "./student-flow.js";
import { bindClassManagementEvents } from "./class-management.js";
import { bindUserManagementEvents } from "./user-management.js";
import { bindSimulatorEvents } from "./simulator.js";
import { bindMonitoringEvents } from "./monitoring.js";
import { bindDemoDataEvents } from "./demo-data.js";
import { bindComplaintEvents } from "./complaints.js";
import { bindApiKeyEvents, loadApiKeys } from "./api-keys.js";
import { bindResearchEvents } from "./research.js";
import { bindObservabilityEvents } from "./observability.js";
import { bindDashboardEvents } from "./dashboard.js";
import { bindQuestionBankEvents } from "./question-bank.js";
import { startNotificationListener } from "./notifications.js";

/**
 * Application entry point. Creates the shared context, wires up all feature
 * modules, and bootstraps the authenticated (or guest) view.
 */
export async function initApp() {
  const ctx = createAppContext();
  ctx.auth = await getCurrentUser();

  // Wire up all feature event handlers against the shared context.
  bindAuthEvents(ctx);
  bindAssessmentWizardEvents(ctx);
  bindStudentFlowEvents(ctx);
  bindClassManagementEvents(ctx);
  bindUserManagementEvents(ctx);
  bindSimulatorEvents(ctx);
  bindMonitoringEvents(ctx);
  bindDemoDataEvents(ctx);
  bindComplaintEvents(ctx);
  bindApiKeyEvents(ctx);
  bindResearchEvents(ctx);
  bindObservabilityEvents(ctx);
  bindDashboardEvents(ctx);
  bindQuestionBankEvents(ctx);

  // Start SSE notification listener for teachers
  if (ctx.auth.authenticated && ["admin", "teacher"].includes(ctx.auth.user.role)) {
    startNotificationListener(ctx);
  }

  // Navigation
  ctx.els.mainNav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-button");
    if (btn) switchView(ctx, btn.dataset.view);
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

  const { refreshSimulatorIfEnabled } = await import("./app-context.js");
  refreshSimulatorIfEnabled(ctx);

  // Dark mode toggle
  const savedTheme = localStorage.getItem("lisan-theme");
  if (savedTheme === "dark") document.documentElement.classList.add("dark-mode");
  if (ctx.els.darkModeToggle) {
    ctx.els.darkModeToggle.addEventListener("click", () => {
      document.documentElement.classList.toggle("dark-mode");
      const isDark = document.documentElement.classList.contains("dark-mode");
      localStorage.setItem("lisan-theme", isDark ? "dark" : "light");
      ctx.els.darkModeToggle.innerHTML = isDark
        ? '<span aria-hidden="true">☀️</span><span>Mode Terang</span>'
        : '<span aria-hidden="true">🌙</span><span>Mode Gelap</span>';
    });
    const isDark = document.documentElement.classList.contains("dark-mode");
    ctx.els.darkModeToggle.innerHTML = isDark
      ? '<span aria-hidden="true">☀️</span><span>Mode Terang</span>'
      : '<span aria-hidden="true">🌙</span><span>Mode Gelap</span>';
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

  if (ctx.auth.authenticated) {
    await bootstrapAuthenticatedApp(ctx, ctx.auth);
  } else {
    showAuth(ctx);
  }
}