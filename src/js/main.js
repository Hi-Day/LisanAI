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

  // Navigation: clicking a nav button switches the active view.
  ctx.els.mainNav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-button");
    if (btn) switchView(ctx, btn.dataset.view);
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

  if (ctx.auth.authenticated) {
    await bootstrapAuthenticatedApp(ctx, ctx.auth);
  } else {
    showAuth(ctx);
  }
}