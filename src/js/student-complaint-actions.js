import { submitComplaint } from "./api.js";
import { showResult } from "./render.js";
import { showToast, showConfirmDialog, showFormDialog } from "./toast.js";

/**
 * Student-only complaint actions for an evaluation result.
 * Teacher/admin monitoring must not carry student complaint submission logic.
 */
export function bindStudentComplaintActions(ctx) {
  const { els } = ctx;
  if (!els.resultPanel) return;
  if (els.resultPanel.dataset.studentComplaintBound === "true") return;
  els.resultPanel.dataset.studentComplaintBound = "true";

  els.resultPanel.addEventListener("click", async (event) => {
    const complaintBtn = event.target.closest(".complaint-btn");
    if (!complaintBtn) return;

    const idx = parseInt(complaintBtn.dataset.index, 10);
    const submissionId = els.resultPanel.dataset.submissionId;
    const submission = ctx.state.submissions.find((item) => item.id === submissionId);
    if (!submission) return;

    const questionScore = submission.questionScores[idx];
    if (!questionScore) return;

    const warning = `⚠️ PERHATIAN\n\nAnda akan mengajukan komplain untuk Soal ${idx + 1} (skor ${questionScore.score}).\n\nJika guru menilai bahwa skor yang diberikan sudah sesuai, maka skor soal ini akan dikurangi 20 poin (menjadi ${Math.max(0, questionScore.score - 20)}).\n\nApakah Anda yakin ingin melanjutkan komplain?`;
    if (!await showConfirmDialog(warning, "Komplain")) return;

    const complaint = await showFormDialog({
      title: `Komplain Soal ${idx + 1}`,
      description: `Skor soal ini: ${questionScore.score}. Jelaskan mengapa nilai menurut Anda kurang sesuai.`,
      fields: [{ name: "reason", label: "Alasan komplain", type: "textarea", required: true }],
      okLabel: "Kirim komplain",
    });
    if (!complaint) return;
    const reason = complaint.reason;

    try {
      const result = await submitComplaint(submissionId, idx, reason);
      const updated = result.submission;
      const localIdx = ctx.state.submissions.findIndex((item) => item.id === submissionId);
      if (localIdx >= 0) ctx.state.submissions[localIdx] = updated;
      showToast("Komplain terkirim. Guru akan meninjau ulang.", "success");
      showResult(els, updated, ctx.auth);
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}
