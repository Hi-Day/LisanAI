import { showToast } from "./toast.js";
import { escapeHtml } from "./utils.js";
import { loadStateFromDatabase } from "./api.js";
import { isAwaitingValidation } from "./status.js";

/**
 * Lecturer notifications: the work that waits for a decision — scores to
 * validate and student complaints to answer.
 *
 * The list is derived from the application state and refreshed by a light poll.
 * (The server has no push channel; an earlier EventSource client never received
 * events.)
 */

const POLL_MS = 60_000;
let pollTimer = null;
let knownIds = new Set();

function collect(submissions) {
  const items = [];
  for (const submission of submissions || []) {
    if (isAwaitingValidation(submission)) {
      items.push({
        id: `validation:${submission.id}`,
        title: "Nilai menunggu validasi",
        message: `${submission.studentName || "Siswa"} — ${submission.assessmentTitle || "Penilaian"}`,
        at: submission.submittedAt,
        view: "scoreValidationView",
        action: "Buka Validasi Nilai",
      });
    }
    (submission.questionScores || []).forEach((item, index) => {
      if (item?.complaint?.status !== "pending") return;
      items.push({
        id: `complaint:${submission.id}:${index}`,
        title: "Komplain menunggu jawaban",
        message: `${submission.studentName || "Siswa"} — ${submission.assessmentTitle || "Penilaian"}, soal ${index + 1}`,
        at: item.complaint.submittedAt,
        view: "complaintView",
        action: "Buka Komplain",
      });
    });
  }
  return items.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function render(ctx, items) {
  const { els } = ctx;
  const count = document.getElementById("notifCount");
  if (count) count.textContent = String(items.length);
  if (!els.notifList) return;
  if (!items.length) {
    els.notifList.className = "list-stack empty-state";
    els.notifList.textContent = "Tidak ada yang menunggu tindakan Anda.";
    return;
  }
  els.notifList.className = "list-stack";
  els.notifList.innerHTML = items.map((item) => `
    <article class="feedback-card notif-item">
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.message)}</p>
        <small>${escapeHtml(formatTime(item.at))}</small>
      </div>
      <button type="button" class="secondary-button" data-notif-view="${escapeHtml(item.view)}">${escapeHtml(item.action)}</button>
    </article>`).join("");
}

function setBadge(ctx, count) {
  const badge = ctx.els.notifBadge || document.getElementById("notifBadge");
  if (!badge) return;
  badge.textContent = String(count);
  badge.classList.toggle("hidden", count === 0);
}

async function poll(ctx) {
  if (document.hidden) return;
  let fresh;
  try { fresh = await loadStateFromDatabase(); }
  catch { return; } // A failed poll is retried on the next tick; the list keeps its last known content.
  // Only add what is new; in-progress edits of existing rows in the browser are left untouched.
  const have = new Set(ctx.state.submissions.map((item) => item.id));
  for (const submission of fresh.submissions || []) {
    if (!have.has(submission.id)) ctx.state.submissions.push(submission);
  }
  const items = collect(fresh.submissions);
  const added = items.filter((item) => !knownIds.has(item.id));
  knownIds = new Set(items.map((item) => item.id));
  render(ctx, items);
  if (added.length) {
    setBadge(ctx, added.length);
    showToast(added.length === 1 ? `${added[0].title}: ${added[0].message}` : `${added.length} hal baru menunggu tindakan Anda.`, "info");
  }
}

export function startNotificationListener(ctx) {
  stopNotificationListener();
  const items = collect(ctx.state?.submissions);
  knownIds = new Set(items.map((item) => item.id));
  render(ctx, items);
  ctx.els.notifList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-notif-view]");
    if (button) document.querySelector(`#mainNav [data-view="${button.dataset.notifView}"]`)?.click();
  });
  pollTimer = setInterval(() => poll(ctx), POLL_MS);
}

export function stopNotificationListener() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

/** Opening the Notifikasi view shows the current list and clears the "new" badge. */
export function clearNotificationBadge(ctx) {
  const badge = document.getElementById("notifBadge");
  if (badge) badge.classList.add("hidden");
  if (ctx?.state) render(ctx, collect(ctx.state.submissions));
}
