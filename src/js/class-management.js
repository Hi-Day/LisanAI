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

let createClassPending = false;

/**
 * Teacher-only class management.
 * Student join/list rendering lives in student-class-management.js.
 */
export function bindClassManagementEvents(ctx) {
  if (ctx.classManagementBound) return;
  ctx.classManagementBound = true;
  const { els } = ctx;

  els.classForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (createClassPending) return;
    const name = els.classNameInput.value.trim();
    if (!name) return;

    createClassPending = true;
    const submitButton = event.submitter || els.classForm.querySelector('button[type="submit"]');
    const { setButtonLoading } = await import("./dom.js");
    setButtonLoading(submitButton, true, "Membuat...", "Buat kelas");
    let created = false;
    try {
      const classroom = await createClassroom(name);
      ctx.state.classes.unshift({ ...classroom, status: "teacher" });
      els.classForm.reset();
      created = true;
    } catch (error) {
      showToast(error.message || "Gagal membuat kelas", "error");
    } finally {
      createClassPending = false;
      setButtonLoading(submitButton, false, "Membuat...", "Buat kelas");
    }
    if (created) await renderCurrentState(ctx);
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

function classOptionLabel(classroom) {
  return classroom.name || classroom.class_name || "Kelas tanpa nama";
}

function syncClassDropdown(select) {
  const wrapper = select?.closest(".class-multi-select");
  if (!wrapper) return;
  const button = wrapper.querySelector(".class-multi-select-trigger");
  const menu = wrapper.querySelector(".class-multi-select-menu");
  if (!button || !menu) return;

  const selected = [...select.selectedOptions]
    .filter((option) => option.value)
    .map((option) => ({ value: option.value, label: option.textContent.trim() }));

  button.querySelector(".class-multi-select-label").textContent = selected.length
    ? selected.map((item) => item.label).join(", ")
    : "Pilih kelas";

  menu.querySelectorAll("input[type=checkbox][data-class-value]").forEach((checkbox) => {
    checkbox.checked = selected.some((item) => item.value === checkbox.dataset.classValue);
  });
}

function installClassMultiSelect(select) {
  if (!select || select.dataset.multiDropdownInstalled === "1") {
    if (select) syncClassDropdown(select);
    return;
  }

  select.dataset.multiDropdownInstalled = "1";
  // Native validation would try to focus the visually hidden multi-select.
  // Validation is handled by the assessment wizard/custom trigger instead.
  select.required = false;
  select.setAttribute("aria-required", "true");
  const wrapper = document.createElement("div");
  wrapper.className = "class-multi-select";
  select.parentNode.insertBefore(wrapper, select);
  wrapper.appendChild(select);
  select.classList.add("class-multi-select-source");

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "class-multi-select-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.innerHTML = `<span class="class-multi-select-label">Pilih kelas</span><span class="class-multi-select-chevron" aria-hidden="true">⌄</span>`;

  const menu = document.createElement("div");
  menu.className = "class-multi-select-menu";
  menu.setAttribute("role", "listbox");
  menu.setAttribute("aria-multiselectable", "true");

  trigger.addEventListener("click", () => {
    const open = wrapper.classList.toggle("is-open");
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
  });

  select.addEventListener("change", () => syncClassDropdown(select));

  document.addEventListener("click", (event) => {
    if (!wrapper.contains(event.target)) {
      wrapper.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
    }
  });

  const form = select.closest("form");
  form?.addEventListener("reset", () => {
    window.setTimeout(() => syncClassDropdown(select), 0);
  });

  wrapper.append(trigger, menu);
}

export function renderClasses(ctx) {
  const { els } = ctx;

  if (els.classSelect) {
    installClassMultiSelect(els.classSelect);
    const currentValues = [...els.classSelect.selectedOptions].map((option) => option.value);
    els.classSelect.innerHTML = ctx.state.classes.length
      ? ctx.state.classes.map((item) => `<option value="\${escapeHtml(item.id)}">\${escapeHtml(classOptionLabel(item))}</option>`).join("")
      : `<option value="">Belum ada kelas</option>`;
    currentValues.forEach((value) => {
      const option = [...els.classSelect.options].find((item) => item.value === value);
      if (option) option.selected = true;
    });

    const menu = els.classSelect.closest(".class-multi-select")?.querySelector(".class-multi-select-menu");
    if (menu) {
      menu.innerHTML = [...els.classSelect.options]
        .filter((option) => option.value)
        .map((option) => `
          <label class="class-multi-select-option">
            <input type="checkbox" data-class-value="\${escapeHtml(option.value)}" />
            <span>\${escapeHtml(option.textContent.trim())}</span>
          </label>
        `).join("") || `<div class="class-multi-select-empty">Belum ada kelas</div>`;

      menu.querySelectorAll("input[type=checkbox][data-class-value]").forEach((checkbox) => {
        checkbox.addEventListener("change", () => {
          const option = [...els.classSelect.options].find((item) => item.value === checkbox.dataset.classValue);
          if (option) option.selected = checkbox.checked;
          els.classSelect.dispatchEvent(new Event("change", { bubbles: true }));
        });
      });
      syncClassDropdown(els.classSelect);
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

  if (els.bulkAddClassSelect) {
    const currentValue = els.bulkAddClassSelect.value;
    els.bulkAddClassSelect.innerHTML = `<option value="">Pilih kelas</option>` +
      ctx.state.classes.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(classOptionLabel(c))}</option>`).join("");
    if (currentValue && ctx.state.classes.some((c) => c.id === currentValue)) {
      els.bulkAddClassSelect.value = currentValue;
    }
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
}

async function reloadState(ctx) {
  const { loadState } = await import("./storage.js");
  const nextState = await loadState();
  ctx.state.classes = nextState.classes;
  ctx.state.memberships = nextState.memberships;
  ctx.state.assessments = nextState.assessments;
}