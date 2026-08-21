import { login, registerTenant, logout } from "./api.js";
import { setButtonLoading } from "./dom.js";
import { showToast } from "./toast.js";
import {
  bootstrapAuthenticatedApp,
  clearAuthForms,
  closeRegisterModal,
  handleModalKeyboard,
  openRegisterModal,
  showAuth,
} from "./app-context.js";

/**
 * Authentication UI: login form, register modal, logout, and modal keyboard handling.
 */
export function bindAuthEvents(ctx) {
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
        password: els.loginPassword.value,
      });
      await bootstrapAuthenticatedApp(ctx, nextAuth);
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
        password: els.registerPassword.value,
      });
      closeRegisterModal(ctx);
      await bootstrapAuthenticatedApp(ctx, nextAuth);
    } catch (error) {
      showToast(error.message);
    } finally {
      setButtonLoading(event.submitter, false, "Membuat tenant...", "Buat tenant");
    }
  });

  els.logoutButton.addEventListener("click", async () => {
    await logout();
    ctx.auth = { authenticated: false };
    ctx.state = { assessments: [], submissions: [], classes: [], memberships: [] };
    ctx.users = [];
    ctx.session = null;
    clearAuthForms(ctx);
    showAuth(ctx);
    const { refreshSimulatorIfEnabled } = await import("./app-context.js");
    refreshSimulatorIfEnabled(ctx);
  });
}