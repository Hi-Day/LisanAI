import { saveSubmissionToDatabase } from "./api.js";
import { showToast, showFormDialog } from "./toast.js";
import { escapeHtml } from "./utils.js";
import { questionProse, questionTablesHtml } from "./question-text.js";
import { renderCurrentState } from "./app-context.js";

/**
 * Centralized teacher complaint management.
 * - Teacher: a dedicated view listing all complaints across assessments.
 * - Teacher: nav badge showing the number of pending complaints.
 *
 * Student complaint notifications live in student-complaints.js so the student
 * bundle does not need to load teacher complaint-management code.
 */
export function bindComplaintEvents(ctx) {
  const { els } = ctx;

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
        const newScore = Math.max(0, qs.score - 20);
        const rejection = await showFormDialog({
          title: `Tolak komplain Soal ${questionIndex + 1}?`,
          description: `Skor soal ini dikurangi 20 poin: ${qs.score} → ${newScore}. Mahasiswa akan melihat keputusan dan penjelasan Anda.`,
          fields: [{ name: "response", label: "Penjelasan untuk mahasiswa", type: "textarea" }],
          okLabel: "Tolak komplain",
        });
        if (!rejection) return;
        const response = rejection.response;

        qs.score = newScore;
        qs.complaint = {
          ...qs.complaint,
          status: "rejected",
          response: String(response || "").trim(),
          resolvedAt: new Date().toISOString(),
        };
      } else {
        const review = await showFormDialog({
          title: `Tinjau ulang Soal ${questionIndex + 1}`,
          description: `Skor soal saat ini: ${qs.score}. Nilai akhir dihitung ulang oleh sistem setelah disimpan.`,
          fields: [
            { name: "score", label: "Skor baru (0–100)", type: "number", min: 0, max: 100, value: qs.score, required: true },
            { name: "response", label: "Penjelasan keputusan untuk mahasiswa", type: "textarea" },
          ],
          okLabel: "Simpan keputusan",
        });
        if (!review) return;
        const scoreVal = review.score;
        const response = review.response;

        qs.score = scoreVal;
        qs.complaint = {
          ...qs.complaint,
          status: "resolved",
          response: String(response || "").trim(),
          resolvedAt: new Date().toISOString(),
        };
      }


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
      <div class="complaint-main">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <strong>${escapeHtml(entry.studentName)}</strong>
          <span class="tag">${escapeHtml(entry.assessmentTitle)}</span>
          <span class="tag">Soal ${entry.questionIndex + 1} · Skor ${entry.score}</span>
        </div>
        <p style="margin-top: 6px;"><b>Soal:</b> ${escapeHtml(questionProse(entry.question))}</p>
        ${questionTablesHtml(entry.question)}
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

export function updateComplaintBadge(ctx) {
  const { els } = ctx;
  if (!els.complaintNavBadge) return;
  const { pending } = collectComplaints(ctx);
  els.complaintNavBadge.textContent = String(pending.length);
  els.complaintNavBadge.classList.toggle("hidden", pending.length === 0);
}
