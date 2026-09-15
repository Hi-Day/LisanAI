import { escapeHtml } from "./utils.js";

/**
 * Student-only complaint notification rendering.
 * Teacher complaint handling remains isolated in complaints.js.
 */
export function bindStudentComplaintEvents() {
  // Reserved for student-only notification interactions.
}

export function notifyStudentComplaintStatus(ctx) {
  const { els, auth } = ctx;
  if (!auth?.user || auth.user.role !== "student") return;

  if (els.complaintNotification) {
    els.complaintNotification.classList.add("hidden");
    els.complaintNotification.innerHTML = "";
  }

  if (!els.studentNotifList) return;

  const notifications = [];
  for (const submission of ctx.state.submissions) {
    (submission.questionScores || []).forEach((questionScore, questionIndex) => {
      if (!questionScore.complaint) return;
      const { status, response, reason, submittedAt } = questionScore.complaint;

      if (status === "resolved") {
        notifications.push({
          icon: "✅",
          statusClass: "complaint-resolved",
          title: `Komplain untuk "${submission.assessmentTitle}" (Soal ${questionIndex + 1}) diterima`,
          detail: `Skor baru: ${questionScore.score}.${response ? ` Guru: "${response}"` : ""}`,
          reason,
          submittedAt,
        });
      } else if (status === "rejected") {
        notifications.push({
          icon: "❌",
          statusClass: "complaint-rejected",
          title: `Komplain untuk "${submission.assessmentTitle}" (Soal ${questionIndex + 1}) ditolak`,
          detail: `Skor dikurangi 20 poin menjadi ${questionScore.score}.${response ? ` Guru: "${response}"` : ""}`,
          reason,
          submittedAt,
        });
      }
    });
  }

  if (!notifications.length) {
    els.studentNotifList.className = "complaint-list empty-state";
    els.studentNotifList.innerHTML = "Belum ada notifikasi komplain.";
    return;
  }

  els.studentNotifList.className = "complaint-list";
  els.studentNotifList.innerHTML = notifications
    .map(
      (notification) => `
        <article class="notif-card ${notification.statusClass}">
          <div class="notif-header">
            <span class="notif-icon" aria-hidden="true">${notification.icon}</span>
            <div class="notif-title">
              <strong>${escapeHtml(notification.title)}</strong>
              ${notification.submittedAt ? `<span class="notif-date">${escapeHtml(new Date(notification.submittedAt).toLocaleString("id-ID"))}</span>` : ""}
            </div>
          </div>
          <div class="notif-body">
            ${notification.reason ? `<div class="notif-row"><span class="notif-label">Isi komplain</span><span>${escapeHtml(notification.reason)}</span></div>` : ""}
            <div class="notif-row"><span class="notif-label">Keputusan</span><span>${escapeHtml(notification.detail)}</span></div>
          </div>
        </article>
      `
    )
    .join("");
}
