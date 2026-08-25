import { showToast } from "./toast.js";
import { escapeHtml } from "./utils.js";

/**
 * #4: Real-time notification system using EventSource.
 *
 * Teachers receive live notifications when:
 * - A student submits an assessment
 * - A student submits a complaint
 * - An evaluation run completes
 */

let notifEventSource = null;
let notifCount = 0;

/**
 * Start listening for real-time notifications via SSE.
 * The server endpoint /api/notifications pushes events.
 */
export function startNotificationListener(ctx) {
  stopNotificationListener();

  try {
    notifEventSource = new EventSource("/api/notifications");
    notifEventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleNotification(ctx, data);
      } catch {
        // ignore malformed events
      }
    };
    notifEventSource.onerror = () => {
      // EventSource auto-reconnects; silently handle.
    };
  } catch {
    // SSE not supported; silently degrade.
  }
}

export function stopNotificationListener() {
  if (notifEventSource) {
    notifEventSource.close();
    notifEventSource = null;
  }
}

function handleNotification(ctx, data) {
  const { type, title, message, assessmentId } = data;

  if (type === "submission" || type === "complaint") {
    notifCount += 1;
    updateBadge(ctx);
    showToast(`${title}: ${message}`, "info");

    // Add to notification list
    const { els } = ctx;
    if (els.notifList) {
      const notif = document.createElement("div");
      notif.className = "feedback-card";
      notif.style.borderLeft = "4px solid var(--accent)";
      notif.innerHTML = `
        <div style="display:flex; justify-content:space-between; gap:8px;">
          <div>
            <strong>${escapeHtml(title)}</strong>
            <p style="color:var(--muted); font-size:0.9rem; margin:4px 0;">${escapeHtml(message)}</p>
            <small style="color:var(--muted);">${new Date().toLocaleTimeString("id-ID")}</small>
          </div>
          ${assessmentId ? `<button type="button" class="secondary-button" onclick="window.dispatchEvent(new CustomEvent('notif-view-assessment', {detail:{id:'${assessmentId}'}}))" style="flex-shrink:0; font-size:0.85rem;">Lihat</button>` : ""}
        </div>
      `;
      // Remove empty state
      const empty = els.notifList.querySelector(".empty-state");
      if (empty) empty.remove();
      els.notifList.prepend(notif);

      // Keep only last 20 notifications
      while (els.notifList.children.length > 20) {
        els.notifList.lastElementChild.remove();
      }
    }
  }
}

function updateBadge(ctx) {
  const { els } = ctx;
  if (els.notifBadge) {
    els.notifBadge.textContent = String(notifCount);
    els.notifBadge.classList.toggle("hidden", notifCount === 0);
  }
}

export function clearNotificationBadge() {
  notifCount = 0;
  const badge = document.getElementById("notifBadge");
  if (badge) badge.classList.add("hidden");
}

export function getNotificationCount() {
  return notifCount;
}