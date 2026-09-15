import { joinClass } from "./api.js";
import { loadState } from "./storage.js";
import { escapeHtml } from "./utils.js";

/**
 * Student-only class experience.
 *
 * Intentionally separate from teacher class-management so the student bundle
 * cannot accidentally bind teacher-only class mutation controls.
 */
export function bindStudentClassManagementEvents(ctx) {
  const { els } = ctx;
  if (!els.studentJoinClassForm) return;

  els.studentJoinClassForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = els.studentJoinCode.value.trim();
    if (!code) return;

    try {
      await joinClass(code);
      await reloadStudentClassState(ctx);
      els.studentJoinClassForm.reset();
      renderStudentClasses(ctx);
    } catch (error) {
      // Keep the existing API error handling semantics while preventing a
      // failed join request from breaking the rest of the student shell.
      console.error("Student class join failed:", error);
      throw error;
    }
  });
}

export function renderStudentClasses(ctx) {
  const { els, state } = ctx;
  const activeClasses = state.classes.filter(
    (item) => item.status === "approved" || item.status === "pending"
  );

  if (!activeClasses.length) {
    els.studentClassList.className = "list-stack empty-state";
    els.studentClassList.textContent = "Belum join kelas.";
  } else {
    els.studentClassList.className = "list-stack";
    els.studentClassList.innerHTML = activeClasses
      .map(
        (item) => `
        <article class="list-item">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <p>Status: ${item.status === "approved" ? "Disetujui" : "Menunggu"}</p>
          </div>
        </article>
      `
      )
      .join("");
  }

  if (els.studentClassFilter) {
    const approvedClasses = activeClasses.filter((item) => item.status === "approved");
    const currentValue = els.studentClassFilter.value;
    els.studentClassFilter.innerHTML =
      `<option value="">Semua Kelas</option>` +
      approvedClasses
        .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`)
        .join("");

    if (currentValue && approvedClasses.some((item) => item.id === currentValue)) {
      els.studentClassFilter.value = currentValue;
    }
  }
}

async function reloadStudentClassState(ctx) {
  const nextState = await loadState();
  ctx.state.classes = nextState.classes;
  ctx.state.memberships = nextState.memberships;
  ctx.state.assessments = nextState.assessments;
}
