import { saveSubmissionToDatabase } from "./api.js";
import { showToast } from "./toast.js";
import { escapeHtml } from "./utils.js";
import { renderCurrentState } from "./app-context.js";

/**
 * Centralized complaint management for teachers + student complaint status.
 * - Teacher: a dedicated view listing all complaints across assessments.
 * - Teacher: nav badge showing the number of pending complaints.
 * - Student: notification banner when a complaint is resolved/rejected.
 */
export function bindComplaintEvents(ctx) {
  const { els } = ctx;

  // Teacher handles complaints from the centralized list.
  if (els.complaintList) {
    els.complaintList.addEventListener("click", async (e) => {
      const respondBtn = e.target.closest(".complaint-respond-btn");
      const rejectBtn = e.target.closest(".complaint-reject-btn");
      if (!respondBtn && !rejectBtn) return;

      const submissionId = respondBtn?.dataset.submissionId || rejectBtn?.dataset.submissionId;
      const questionIndex = Number(respondBtn?.dataset.questionIndex ?? rejectBtn?.dataset.questionIndex);
      const submission = ctx.state.submissions.find((s) => s.id === submissionId);
      if (!submission) return;

      const qs = submission.questionScores[questionIndex];
      if (!qs?.complaint) return;

      if (rejectBtn) {
        // Reject: score -20 automatically.
        const newScore = Math.max(0, qs.score - 20);
        const response = prompt(
          `Tolak komplain untuk Soal ${questionIndex + 1}?\n\nSkor akan dikurangi 20 poin: ${qs.score} → ${newScore}\n\nTuliskan penjelasan untuk siswa (opsional):`,
          ""
        );
        if (response === null) return;

        qs.score = newScore;
        qs.complaint = {
          ...qs.complaint,
          status: "rejected",
          response: String(response || "").trim(),
          resolvedAt: new Date().toISOString(),
        };
      } else {
        // Respond: re-evaluate the score manually.
        const newScoreStr = prompt(
          `Re-evaluasi Soal ${questionIndex + 1} (skor saat ini: ${qs.score}):\nMasukkan skor baru (0-100):`,
          qs.score
        );
        if (newScoreStr === null) return;
        const scoreVal = parseInt(newScoreStr, 10);
        if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 100) {
          showToast("Skor tidak valid. Harus angka 0-100", "error");
          return;
        }
        const response = prompt("Respon untuk siswa (penjelasan keputusan):", "");
        if (response === null) return;

        qs.score = scoreVal;
        qs.complaint = {
          ...qs.complaint,
          status: "resolved",
          response: String(response || "").trim(),
          resolvedAt: new Date().toISOString(),
        };
      }

      submission.finalScore = Math.round(
        submission.questionScores.reduce((acc, curr) => acc + curr.score, 0) / submission.questionScores.length
      );

      try {
        await saveSubmissionToDatabase(submission);
        showToast("Komplain berhasil diproses", "success");
        renderComplaints(ctx);
        updateComplaintBadge(ctx);
        renderCurrentState(ctx);
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }
}

/**
 * Collect all complaints from submissions, grouped by status.
 * Returns { pending, resolved, rejected } arrays of complaint entries.
 */
export function collectComplaints(ctx) {
  const entries = [];
  for (const submission of ctx.state.submissions) {
    (submission.questionScores || []).forEach((qs, questionIndex) => {
      if (!qs.complaint) return;
      entries.push({
        submissionId: submission.id,
        studentName: submission.studentName,
        assessmentTitle: submission.assessmentTitle,
        questionIndex,
        question: qs.question,
        answer: qs.answer,
        score: qs.score,
        complaint: qs.complaint,
      });
    });
  }
  return {
    pending: entries.filter((e) => e.complaint.status === "pending"),
    resolved: entries.filter((e) => e.complaint.status === "resolved"),
    rejected: entries.filter((e) => e.complaint.status === "rejected"),
  };
}

export function renderComplaints(ctx) {
  const { els } = ctx;
  if (!els.complaintList) return;

  const { pending, resolved, rejected } = collectComplaints(ctx);
  els.complaintCount.textContent = String(pending.length);

  if (!pending.length && !resolved.length && !rejected.length) {
    els.complaintList.className = "complaint-list empty-state";
    els.complaintList.innerHTML = "Belum ada komplain.";
    return;
  }

  els.complaintList.className = "complaint-list";
  els.complaintList.innerHTML = `
    ${renderComplaintGroup("Menunggu", pending, "complaint-pending")}
    ${renderComplaintGroup("Selesai", resolved, "complaint-resolved")}
    ${renderComplaintGroup("Ditolak", rejected, "complaint-rejected")}
  `;
}

function renderComplaintGroup(title, items, statusClass) {
  if (!items.length) return "";
  return `
    <div class="complaint-group">
      <h4>${escapeHtml(title)} (${items.length})</h4>
      ${items.map((entry) => renderComplaintItem(entry, statusClass)).join("")}
    </div>
  `;
}

function renderComplaintItem(entry, statusClass) {
  const { complaint } = entry;
  const isPending = complaint.status === "pending";
  const actionButtons = isPending
    ? `
      <div class="item-actions">
        <button type="button" class="action-button complaint-respond-btn" data-submission-id="${escapeHtml(entry.submissionId)}" data-question-index="${entry.questionIndex}">Respon</button>
        <button type="button" class="action-button danger-button complaint-reject-btn" data-submission-id="${escapeHtml(entry.submissionId)}" data-question-index="${entry.questionIndex}">Tolak (-20)</button>
      </div>
    `
    : "";

  return `
    <article class="complaint-item ${statusClass}">
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <strong>${escapeHtml(entry.studentName)}</strong>
          <span class="tag">${escapeHtml(entry.assessmentTitle)}</span>
          <span class="tag">Soal ${entry.questionIndex + 1} · Skor ${entry.score}</span>
        </div>
        <p style="margin-top: 6px;"><b>Soal:</b> ${escapeHtml(entry.question)}</p>
        <p><b>Jawaban:</b> <i>"${escapeHtml(entry.answer || "Tidak ada jawaban")}"</i></p>
        <div class="complaint-box ${statusClass}" style="margin: 8px 0 0;">
          <strong>📩 Komplain:</strong>
          <p>${escapeHtml(complaint.reason)}</p>
          ${complaint.response ? `<p class="complaint-response"><b>Respon:</b> ${escapeHtml(complaint.response)}</p>` : ""}
          <span class="tag">${escapeHtml(complaint.submittedAt ? new Date(complaint.submittedAt).toLocaleString("id-ID") : "")}</span>
        </div>
      </div>
      ${actionButtons}
    </article>
  `;
}

/**
 * Update the teacher nav badge with the number of pending complaints.
 */
export function updateComplaintBadge(ctx) {
  const { els } = ctx;
  if (!els.complaintNavBadge) return;
  const { pending } = collectComplaints(ctx);
  els.complaintNavBadge.textContent = String(pending.length);
  els.complaintNavBadge.classList.toggle("hidden", pending.length === 0);
}

/**
 * Show the student's complaint statuses in the dedicated Notifikasi tab.
 * Called after state reload so the student sees the latest status.
 */
export function notifyStudentComplaintStatus(ctx) {
  const { els, auth } = ctx;
  if (!auth?.user || auth.user.role !== "student") return;

  // Remove the old assessment-page banner now that notifications
  // live in their own tabs.
  if (els.complaintNotification) {
    els.complaintNotification.classList.add("hidden");
    els.complaintNotification.innerHTML = "";
  }

  if (!els.studentNotifList) return;

  const notifications = [];
  for (const submission of ctx.state.submissions) {
    (submission.questionScores || []).forEach((qs, questionIndex) => {
      if (!qs.complaint) return;
      const { status, response, reason, submittedAt } = qs.complaint;
      if (status === "resolved") {
        notifications.push({
          icon: "✅",
          statusClass: "complaint-resolved",
          title: `Komplain untuk "${submission.assessmentTitle}" (Soal ${questionIndex + 1}) diterima`,
          detail: `Skor baru: ${qs.score}.${response ? ` Guru: "${response}"` : ""}`,
          reason,
          submittedAt,
        });
      } else if (status === "rejected") {
        notifications.push({
          icon: "❌",
          statusClass: "complaint-rejected",
          title: `Komplain untuk "${submission.assessmentTitle}" (Soal ${questionIndex + 1}) ditolak`,
          detail: `Skor dikurangi 20 poin menjadi ${qs.score}.${response ? ` Guru: "${response}"` : ""}`,
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
      (n) => `
        <article class="notif-card ${n.statusClass}">
          <div class="notif-header">
            <span class="notif-icon" aria-hidden="true">${n.icon}</span>
            <div class="notif-title">
              <strong>${escapeHtml(n.title)}</strong>
              ${n.submittedAt ? `<span class="notif-date">${escapeHtml(new Date(n.submittedAt).toLocaleString("id-ID"))}</span>` : ""}
            </div>
          </div>
          <div class="notif-body">
            ${n.reason ? `<div class="notif-row"><span class="notif-label">Isi komplain</span><span>${escapeHtml(n.reason)}</span></div>` : ""}
            <div class="notif-row"><span class="notif-label">Keputusan</span><span>${escapeHtml(n.detail)}</span></div>
          </div>
        </article>
      `
    )
    .join("");
}