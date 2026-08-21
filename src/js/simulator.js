import { getSimulationData, simulateLogin } from "./api.js";
import { showToast } from "./toast.js";
import { bootstrapAuthenticatedApp, refreshSimulatorIfEnabled, renderSimulator } from "./app-context.js";

/**
 * Demo simulator panel: tenant/user listing and one-click login.
 */
export function bindSimulatorEvents(ctx) {
  const { els } = ctx;

  if (els.simulatorToggle) {
    els.simulatorToggle.addEventListener("click", () => {
      const isHidden = els.simulatorPanel.classList.toggle("hidden");
      els.simulatorToggle.setAttribute("aria-expanded", !isHidden);
      if (!isHidden) {
        refreshSimulatorIfEnabled(ctx);
      }
    });
  }

  if (els.simulatorClose) {
    els.simulatorClose.addEventListener("click", () => {
      els.simulatorPanel.classList.add("hidden");
      els.simulatorToggle.setAttribute("aria-expanded", "false");
    });
  }

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
        await bootstrapAuthenticatedApp(ctx, nextAuth);
      } catch (error) {
        showToast(error.message, "error");
        loginBtn.disabled = false;
        loginBtn.textContent = "Masuk";
      }
    });
  }
}

export { getSimulationData, renderSimulator };