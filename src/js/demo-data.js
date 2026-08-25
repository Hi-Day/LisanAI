import { seedDemoData } from "./api.js";
import { showToast, showConfirmDialog } from "./toast.js";
import { refreshSimulatorIfEnabled } from "./app-context.js";

/**
 * Demo data utilities: seed demo data for the teacher or admin role, and
 * remove ONLY the seeded dummy data (original data is never touched).
 */
export function bindDemoDataEvents(ctx) {
  const { els } = ctx;

  // Seed teacher demo data (classes, students, assessments, submissions,
  // complaints) so all teacher menus present meaningful content.
  if (els.seedDemoTeacher) {
    els.seedDemoTeacher.addEventListener("click", async () => {
      if (ctx.state.assessments.length) {
        showToast("Data contoh sudah ada. Gunakan 'Hapus data dummy' untuk mengisi ulang.");
        return;
      }
      try {
        const result = await seedDemoData("teacher");
        await refreshDemoState(ctx);
        showToast(
          `Data contoh guru dibuat: ${result.assessmentsAdded} penilaian, ${result.studentsAdded} siswa.`,
          "success"
        );
      } catch (error) {
        showToast(`Gagal mengisi data contoh guru: ${error.message}`);
      }
    });
  }

  // Seed admin demo data (adds observability, research runs, API keys on top
  // of the teacher dataset) so all admin menus can be presented.
  if (els.seedDemoAdmin) {
    els.seedDemoAdmin.addEventListener("click", async () => {
      try {
        const result = await seedDemoData("admin");
        await refreshDemoState(ctx);
        showToast(
          `Data contoh admin siap: observabilitas, riset (${result.runsCreated} run), dan API keys.`,
          "success"
        );
      } catch (error) {
        showToast(`Gagal mengisi data contoh admin: ${error.message}`);
      }
    });
  }

  // Remove ONLY the demo (dummy) data — keeps original/organic data intact.
  if (els.removeDemoData) {
    els.removeDemoData.addEventListener("click", async () => {
      if (!await showConfirmDialog("Hapus data dummy (data contoh) saja? Data asli Anda tetap aman.", "Hapus Data Dummy")) return;
      try {
        const { removeDemoData } = await import("./api.js");
        const result = await removeDemoData();
        await refreshDemoState(ctx);
        showToast(
          `Data dummy dihapus: ${result.removed} baris.`,
          "success"
        );
      } catch (error) {
        showToast(`Gagal menghapus data dummy: ${error.message}`, "error");
      }
    });
  }
}

async function refreshDemoState(ctx) {
  const { loadState } = await import("./storage.js");
  const next = await loadState();
  ctx.state.assessments = next.assessments;
  ctx.state.submissions = next.submissions;
  ctx.state.classes = next.classes;
  ctx.state.memberships = next.memberships;
  if (ctx.auth.user.role === "admin") {
    const { loadUsers } = await import("./app-context.js");
    ctx.users = await loadUsers(ctx);
    const { renderUsers } = await import("./user-management.js");
    renderUsers(ctx);
  }
  await renderCurrentState(ctx);
  await refreshSimulatorIfEnabled(ctx);
}