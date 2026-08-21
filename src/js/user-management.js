import {
  createUser,
  createUsersBatch,
  deleteUser,
  updateUser,
} from "./api.js";
import { setButtonLoading } from "./dom.js";
import { showToast } from "./toast.js";
import { escapeHtml, roleLabel } from "./utils.js";
import { loadUsers, refreshSimulatorIfEnabled } from "./app-context.js";

/**
 * Admin user management: create single user, bulk CSV upload, role editing,
 * and bulk delete.
 */
export function bindUserManagementEvents(ctx) {
  const { els } = ctx;

  els.userForm.addEventListener("submit", (event) => handleCreateUser(ctx, event));
  els.csvForm.addEventListener("submit", (event) => handleCsvUpload(ctx, event));

  if (els.selectAllUsers) {
    els.selectAllUsers.checked = false;
    els.selectAllUsers.addEventListener("change", () => {
      const checked = els.selectAllUsers.checked;
      [...els.userList.querySelectorAll(".select-user")].forEach((cb) => (cb.checked = checked));
    });
  }

  els.userList.addEventListener("click", async (event) => {
    const article = event.target.closest("article");
    if (!article) return;
    const id = article.dataset.id;

    if (event.target.classList.contains("edit-user")) {
      const currentUser = ctx.users.find((u) => u.id === id);
      if (!currentUser) return;
      const newRole = prompt(`Ubah role untuk ${currentUser.name} (student/teacher/admin):`, currentUser.role);
      if (newRole && ["student", "teacher", "admin"].includes(newRole) && newRole !== currentUser.role) {
        await updateUser(id, { role: newRole });
        ctx.users = await loadUsers(ctx);
        renderUsers(ctx);
      } else if (newRole) {
        showToast("Role tidak valid. Harus student, teacher, atau admin.");
      }
    } else if (event.target.classList.contains("delete-user")) {
      if (!confirm("Hapus user ini?")) return;
      await deleteUser(id);
      ctx.users = await loadUsers(ctx);
      renderUsers(ctx);
    }
  });

  if (els.deleteSelectedUsers) {
    els.deleteSelectedUsers.addEventListener("click", async () => {
      const selected = [...els.userList.querySelectorAll(".select-user:checked")].map((cb) => cb.dataset.id);
      if (!selected.length) {
        showToast("Pilih akun terlebih dahulu", "error");
        return;
      }
      if (!confirm(`Hapus ${selected.length} akun terpilih? Tindakan ini tidak bisa dibatalkan.`)) return;

      els.deleteSelectedUsers.disabled = true;
      try {
        const results = { success: [], errors: [] };
        for (const id of selected) {
          try {
            await deleteUser(id);
            results.success.push(id);
          } catch (err) {
            results.errors.push({ id, message: err.message || String(err) });
          }
        }

        if (results.success.length) {
          ctx.users = await loadUsers(ctx);
          renderUsers(ctx);
          refreshSimulatorIfEnabled(ctx);
        }

        if (results.errors.length) {
          showToast(`Selesai. Berhasil: ${results.success.length}. Gagal: ${results.errors.length}`, "error");
        } else {
          showToast(`Berhasil menghapus ${results.success.length} akun.`, "success");
        }
      } finally {
        els.deleteSelectedUsers.disabled = false;
      }
    });
  }
}

export async function handleCreateUser(ctx, event) {
  event.preventDefault();
  const { els } = ctx;
  setButtonLoading(event.submitter, true, "Membuat akun...", "Buat akun");
  try {
    const user = await createUser({
      name: els.userName.value,
      email: els.userEmail.value,
      password: els.userPassword.value,
      role: els.userRole.value,
    });
    ctx.users.unshift(user);
    els.userForm.reset();
    renderUsers(ctx);
    refreshSimulatorIfEnabled(ctx);
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setButtonLoading(event.submitter, false, "Membuat akun...", "Buat akun");
  }
}

export async function handleCsvUpload(ctx, event) {
  event.preventDefault();
  const { els } = ctx;
  const file = els.csvFile.files[0];
  if (!file) return;

  setButtonLoading(event.submitter, true, "Memproses...", "Upload & Proses CSV");

  try {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

    const payload = lines.map((line) => {
      const [name, email, role, password] = line.split(",").map((item) => item.trim());
      return { name, email, role, password };
    });

    if (payload.length === 0) {
      throw new Error("File CSV kosong atau format tidak valid");
    }

    const response = await createUsersBatch(payload);

    if (response.success && response.success.length > 0) {
      ctx.users.unshift(...response.success);
      renderUsers(ctx);
      refreshSimulatorIfEnabled(ctx);
    }

    const successCount = response.success ? response.success.length : 0;
    const errorCount = response.errors ? response.errors.length : 0;

    if (errorCount === 0) {
      showToast(`Berhasil membuat ${successCount} akun baru dari CSV.`, "success");
      els.csvForm.reset();
    } else {
      const errMsg = response.errors[0]?.message || "Beberapa baris gagal";
      showToast(`Selesai. Sukses: ${successCount}. Gagal: ${errorCount} (${errMsg})`, "error");
      els.csvForm.reset();
    }
  } catch (error) {
    showToast(error.message || "Gagal memproses file CSV", "error");
  } finally {
    setButtonLoading(event.submitter, false, "Memproses...", "Upload & Crop CSV");
  }
}

export function renderUsers(ctx) {
  const { els, auth } = ctx;
  if (auth.user?.role !== "admin") return;
  const extraUsers = ctx.users.filter((user) => user.id !== auth.user.id);
  if (!extraUsers.length) {
    els.userList.className = "list-stack empty-state";
    els.userList.textContent = "Belum ada akun tambahan.";
    return;
  }

  els.userList.className = "list-stack";
  els.userList.innerHTML = extraUsers.map((user) => `
    <article class="list-item" data-id="${user.id}">
      <div style="flex: 1; min-width: 0; display:flex; gap:12px; align-items:center;">
        <input type="checkbox" class="select-user" data-id="${user.id}" aria-label="Pilih user" />
        <div style="flex:1; min-width:0;">
          <strong>${escapeHtml(user.name)}</strong>
          <p>${escapeHtml(user.email)}</p>
        </div>
        <div class="item-actions">
          <button type="button" class="action-button edit-user">Ubah Role</button>
          <button type="button" class="action-button danger-button delete-user">Hapus</button>
        </div>
      </div>
      <span class="user-role">${escapeHtml(roleLabel(user.role))}</span>
    </article>
  `).join("");
}