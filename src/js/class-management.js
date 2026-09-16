import {
  approveJoinRequest,
  createClassroom,
  deleteClassroom,
  deleteMembership,
  updateClassroom,
  updateMembership,
} from "./api.js";
import { showToast, showConfirmDialog } from "./toast.js";
import { escapeHtml } from "./utils.js";
import { renderCurrentState } from "./app-context.js";

/**
 * Teacher-only class management.
 * Student join/list rendering lives in student-class-management.js.
 */
export function bindClassManagementEvents(ctx) {
  const { els } = ctx;

  els.classForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = els.classNameInput.value.trim();
    if (!name) return;
    const classroom = await createClassroom(name);
    ctx.state.classes.unshift({ ...classroom, status: "teacher" });
    els.classForm.reset();
    await renderCurrentState(ctx);
  });

  els.pendingJoinList.addEventListener("click", async (event) => {
    const id = event.target.dataset.id;
    if (!id) return;
    if (event.target.classList.contains("approve-join")) {
      await approveJoinRequest(id);
    } else if (event.target.classList.contains("reject-join")) {
      await updateMembership(id, "rejected");
    } else return;

    await reloadState(ctx);
    await renderCurrentState(ctx);
  });

  if (els.approvedMemberList) {
    els.approvedMemberList.addEventListener("click", async (event) => {
      const id = event.target.dataset.id;
      if (!id || !event.target.classList.contains("remove-member")) return;
      if (!await showConfirmDialog("Keluarkan siswa dari kelas ini?", "Hapus Anggota")) return;

      await deleteMembership(id);
      await reloadState(ctx);
      await renderCurrentState(ctx);
    });
  }

  if (els.memberSearchInput) {
    els.memberSearchInput.addEventListener("input", (event) => {
      ctx.memberSearchQuery = event.target.value;
      ctx.memberCurrentPage = 1;
      renderClasses(ctx);
    });
  }

  if (els.memberPrevBtn) {
    els.memberPrevBtn.addEventListener("click", () => {
      if (ctx.memberCurrentPage > 1) {
        ctx.memberCurrentPage--;
        renderClasses(ctx);
        els.approvedMemberList.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  if (els.memberNextBtn) {
    els.memberNextBtn.addEventListener("click", () => {
      const approved = ctx.state.memberships.filter((item) => item.status === "approved");
      const filtered = ctx.memberSearchQuery.trim() === ""
        ? approved
        : approved.filter((item) => {
            const searchLower = ctx.memberSearchQuery.toLowerCase();
            return (
              item.student_name.toLowerCase().includes(searchLower) ||
              item.student_email.toLowerCase().includes(searchLower)
            );
          });
      const totalPages = Math.ceil(filtered.length / ctx.MEMBERS_PER_PAGE);

      if (ctx.memberCurrentPage < totalPages) {
        ctx.memberCurrentPage++;
        renderClasses(ctx);
        els.approvedMemberList.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  els.classList.addEventListener("click", async (event) => {
    const article = event.target.closest("article");
    if (!article) return;
    const id = article.dataset.id;

    if (event.target.classList.contains("edit-class")) {
      const currentName = ctx.state.classes.find((c) => c.id === id)?.name || "";
      const newName = prompt("Nama kelas baru:", currentName);
      if (newName && newName !== currentName) {
        await updateClassroom(id, { name: newName });
        await reloadState(ctx);
        await renderCurrentState(ctx);
      }
    } else if (event.target.classList.contains("delete-class")) {
      if (!await showConfirmDialog("Hapus kelas beserta semua datanya?", "Hapus Kelas")) return;
      await deleteClassroom(id);
      await reloadState(ctx);
      await renderCurrentState(ctx);
    }
  });

  if (els.bulkAddButton) {
    els.bulkAddButton.addEventListener("click", async () => {
      const classId = els.bulkAddClassSelect?.value;
      const raw = els.bulkAddEmails?.value || "";
      const emails = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      if (!classId) return showToast("Pilih kelas tujuan terlebih dahulu", "error");
      if (!emails.length) return showToast("Masukkan minimal 1 email", "error");

      const { setButtonLoading } = await import("./dom.js");
      setButtonLoading(els.bulkAddButton, true, "Menambahkan...", "Tambahkan ke Kelas");
      try {
        const { addStudentsToClass } = await import("./api.js");
        const resp = await addStudentsToClass({ classId, emails });
        const addedCount = resp.added ? resp.added.length : 0;
        const errorCount = resp.errors ? resp.errors.length : 0;
        if (addedCount) {
          showToast(`Berhasil menambahkan ${addedCount} siswa.`, "success");
          await reloadState(ctx);
          await renderCurrentState(ctx);
        }
        if (errorCount) {
          showToast(`Beberapa email gagal ditambahkan: ${errorCount}`, "error");
          console.warn("Bulk add errors", resp.errors);
        }
        els.bulkAddEmails.value = "";
      } catch (err) {
        showToast(err.message || "Gagal menambahkan siswa", "error");
      } finally {
        setButtonLoading(els.bulkAddButton, false, "Menambahkan...", "Tambahkan ke Kelas");
      }
    });

    if (els.bulkAddClear) {
      els.bulkAddClear.addEventListener("click", () => {
        if (els.bulkAddEmails) els.bulkAddEmails.value = "";
      });
    }
  }

  if (els.bulkAddCsvUpload) {
    els.bulkAddCsvUpload.addEventListener("click", async () => {
      const file = els.bulkAddCsvFile.files[0];
      if (!file) return showToast("Pilih file CSV terlebih dahulu", "error");
      const { setButtonLoading } = await import("./dom.js");
      setButtonLoading(els.bulkAddCsvUpload, true, "Mengunggah...", "Upload CSV");
      try {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
        const parsed = lines.map((line, idx) => {
          const parts = line.split(",").map((item) => item.trim());
          return { name: parts[0] || "", email: parts[1] || "", password: parts[2] || "", row: idx + 1 };
        });

        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const valid = [];
        const invalid = [];
        for (const p of parsed) {
          const errs = [];
          if (!p.name) errs.push("Nama kosong");
          if (!emailRe.test(p.email)) errs.push("Email tidak valid");
          if (!p.password || p.password.length < 8) errs.push("Password minimal 8 karakter");
          if (errs.length) invalid.push({ row: p.row, email: p.email, errors: errs });
          else valid.push(p);
        }

        if (invalid.length) {
          const sample = invalid.slice(0, 5).map((i) => `Baris ${i.row}: ${i.email} (${i.errors.join("; ")})`).join("\n");
          const proceed = await showConfirmDialog(`Ditemukan ${invalid.length} baris bermasalah. Contoh:\n${sample}\n\nLanjutkan dan lewati baris bermasalah?`, "Baris Bermasalah");
          if (!proceed) {
            setButtonLoading(els.bulkAddCsvUpload, false, "Mengunggah...", "Upload CSV");
            return;
          }
        }

        const payload = valid.map(({ name, email, password }) => ({ name, email, password }));
        const classId = els.bulkAddClassSelect?.value;
        if (!classId) return showToast("Pilih kelas terlebih dahulu", "error");
        const { createStudentsBatch } = await import("./api.js");
        const resp = await createStudentsBatch({ classId, users: payload });
        const added = resp.added ? resp.added.length : 0;
        const errors = resp.errors ? resp.errors.length : 0;
        if (added) {
          showToast(`Berhasil menambahkan ${added} siswa.`, "success");
          await reloadState(ctx);
          await renderCurrentState(ctx);
        }
        if (errors) showToast(`Selesai. Gagal: ${errors}`, "error");
        els.bulkAddCsvFile.value = null;
      } catch (err) {
        showToast(err.message || "Gagal mengunggah CSV", "error");
      } finally {
        setButtonLoading(els.bulkAddCsvUpload, false, "Mengunggah...", "Upload CSV");
      }
    });
  }
}

export function renderClasses(ctx) {
  const { els } = ctx;

  if (els.classSelect) {
    const currentValue = els.classSelect.value;
    els.classSelect.innerHTML = ctx.state.classes.length
      ? ctx.state.classes.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("")
      : `<option value="">Belum ada kelas</option>`;
    if (currentValue && ctx.state.classes.some((item) => item.id === currentValue)) {
      els.classSelect.value = currentValue;
    }
  }

  if (!ctx.state.classes.length) {
    els.classList.className = "list-stack empty-state";
    els.classList.textContent = "Belum ada kelas.";
  } else {
    els.classList.className = "list-stack";
    els.classList.innerHTML = ctx.state.classes.map((item) => `
      <article class="submission-item" data-id="${escapeHtml(item.id)}">
        <div style="flex: 1; min-width: 0;">
          <strong>${escapeHtml(item.name)}</strong>
          <p>Kode: <b>${escapeHtml(item.join_code || item.joinCode || "-")}</b></p>
          <div class="item-actions">
            <button type="button" class="action-button edit-class">Edit</button>
            <button type="button" class="action-button danger-button delete-class">Hapus</button>
          </div>
        </div>
      </article>
    `).join("");
  }

  const pending = ctx.state.memberships.filter((item) => item.status === "pending");
  if (!pending.length) {
    els.pendingJoinList.className = "list-stack empty-state";
    els.pendingJoinList.textContent = "Belum ada request join.";
  } else {
    els.pendingJoinList.className = "list-stack";
    els.pendingJoinList.innerHTML = pending.map((item) => `
      <article class="list-item">
        <div>
          <strong>${escapeHtml(item.student_name)}</strong>
          <p>${escapeHtml(item.student_email)} - ${escapeHtml(item.class_name)}</p>
        </div>
        <div class="item-actions">
          <button class="secondary-button approve-join" data-id="${escapeHtml(item.id)}" type="button">Approve</button>
          <button class="action-button danger-button reject-join" data-id="${escapeHtml(item.id)}" type="button">Tolak</button>
        </div>
      </article>
    `).join("");
  }

  if (els.approvedMemberList) {
    const approved = ctx.state.memberships.filter((item) => item.status === "approved");
    const filtered = ctx.memberSearchQuery.trim() === ""
      ? approved
      : approved.filter((item) => {
          const searchLower = ctx.memberSearchQuery.toLowerCase();
          return (
            item.student_name.toLowerCase().includes(searchLower) ||
            item.student_email.toLowerCase().includes(searchLower)
          );
        });

    if (els.memberCountText) els.memberCountText.textContent = `${filtered.length} anggota`;

    if (!filtered.length) {
      els.approvedMemberList.className = "list-stack empty-state";
      els.approvedMemberList.textContent = ctx.memberSearchQuery.trim() === ""
        ? "Belum ada anggota."
        : "Tidak ada hasil pencarian.";
      if (els.memberPaginationContainer) els.memberPaginationContainer.style.display = "none";
      return;
    }

    const totalPages = Math.ceil(filtered.length / ctx.MEMBERS_PER_PAGE);
    if (ctx.memberCurrentPage > totalPages) ctx.memberCurrentPage = Math.max(1, totalPages);

    const startIdx = (ctx.memberCurrentPage - 1) * ctx.MEMBERS_PER_PAGE;
    const pageItems = filtered.slice(startIdx, startIdx + ctx.MEMBERS_PER_PAGE);

    els.approvedMemberList.className = "list-stack";
    els.approvedMemberList.innerHTML = pageItems.map((item) => `
      <article class="list-item">
        <div>
          <strong>${escapeHtml(item.student_name)}</strong>
          <p>${escapeHtml(item.student_email)}</p>
          <p style="font-size: 0.85rem; color: var(--muted); margin-top: 4px;">${escapeHtml(item.class_name)}</p>
          <div class="item-actions">
            <button class="action-button danger-button remove-member" data-id="${escapeHtml(item.id)}" type="button">Keluarkan</button>
          </div>
        </div>
      </article>
    `).join("");

    if (els.memberPaginationContainer) {
      if (totalPages <= 1) {
        els.memberPaginationContainer.style.display = "none";
      } else {
        els.memberPaginationContainer.style.display = "flex";
        els.memberPrevBtn.disabled = ctx.memberCurrentPage === 1;
        els.memberNextBtn.disabled = ctx.memberCurrentPage === totalPages;
        els.memberPageInfo.textContent = `Halaman ${ctx.memberCurrentPage} dari ${totalPages}`;
      }
    }
  }

  if (els.bulkAddClassSelect) {
    const classOptions = ctx.state.classes.map((c) => ({ id: c.id, name: c.name }));
    els.bulkAddClassSelect.innerHTML = `<option value="">Pilih kelas</option>` +
      classOptions.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join("");
  }
}

async function reloadState(ctx) {
  const { loadState } = await import("./storage.js");
  const nextState = await loadState();
  ctx.state.classes = nextState.classes;
  ctx.state.memberships = nextState.memberships;
  ctx.state.assessments = nextState.assessments;
}