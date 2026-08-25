import {
  deleteAssessment,
  getSubmissionDetail,
  saveSubmissionToDatabase,
  updateAssessment,
} from "./api.js";
import { renderMonitoring, renderStudentHistory, showResult } from "./render.js";
import { showToast, showConfirmDialog } from "./toast.js";
import { renderCurrentState, switchView } from "./app-context.js";

/**
 * Monitoring & assessment management: submission review, score override,
 * assessment close/reopen/delete, and CSV grade export.
 */
export function bindMonitoringEvents(ctx) {
  const { els } = ctx;

  els.submissionList.addEventListener("click", async (e) => {
    const viewBtn = e.target.closest(".view-submission-btn");
    if (!viewBtn) return;
    const item = viewBtn.closest(".submission-row");
    const submissionId = item.dataset.id;
    await openSubmissionForReview(ctx, submissionId);
  });

  els.studentHistoryList.addEventListener("click", async (e) => {
    const viewBtn = e.target.closest(".view-submission-btn");
    if (!viewBtn) return;
    const item = viewBtn.closest(".submission-row");
    const submissionId = item.dataset.id;
    await openSubmissionForReview(ctx, submissionId);
  });

  async function openSubmissionForReview(ctx, submissionId) {
    const summary = ctx.state.submissions.find((s) => s.id === submissionId);
    if (!summary) return;
    let submission = summary;
    try {
      submission = await getSubmissionDetail(submissionId);
    } catch {
      // Fall back to the summary already in state so detail views still work.
    }
    showResult(ctx.els, submission, ctx.auth);
  }

  els.resultPanel.addEventListener("click", async (e) => {
    if (e.target.closest(".close-result-btn") || e.target === els.resultPanel) {
      const { closeResultModal } = await import("./app-context.js");
      closeResultModal(ctx);
      return;
    }

    // Student submits a complaint on a specific question.
    const complaintBtn = e.target.closest(".complaint-btn");
    if (complaintBtn) {
      const idx = parseInt(complaintBtn.dataset.index, 10);
      const submissionId = els.resultPanel.dataset.submissionId;
      const submission = ctx.state.submissions.find((s) => s.id === submissionId);
      if (!submission) return;

      const qs = submission.questionScores[idx];
      const warning = `⚠️ PERHATIAN\n\nAnda akan mengajukan komplain untuk Soal ${idx + 1} (skor ${qs.score}).\n\nJika guru menilai bahwa skor yang diberikan sudah sesuai, maka skor soal ini akan dikurangi 20 poin (menjadi ${Math.max(0, qs.score - 20)}).\n\nApakah Anda yakin ingin melanjutkan komplain?`;
      if (!await showConfirmDialog(warning, "Komplain")) return;

      const reason = prompt(`Komplain untuk Soal ${idx + 1} (skor ${qs.score}):\nJelaskan alasan Anda merasa nilai kurang sesuai.`);
      if (reason === null) return;
      if (!reason.trim()) {
        showToast("Alasan komplain wajib diisi", "error");
        return;
      }

      try {
        const { submitComplaint } = await import("./api.js");
        const result = await submitComplaint(submissionId, idx, reason);
        // Update local state with the returned submission.
        const updated = result.submission;
        const localIdx = ctx.state.submissions.findIndex((s) => s.id === submissionId);
        if (localIdx >= 0) ctx.state.submissions[localIdx] = updated;
        showToast("Komplain terkirim. Guru akan meninjau ulang.", "success");
        showResult(els, updated, ctx.auth);
      } catch (err) {
        showToast(err.message, "error");
      }
      return;
    }

    // Teacher responds to a complaint and re-evaluates the score.
    const respondBtn = e.target.closest(".respond-complaint-btn");
    if (respondBtn) {
      const idx = parseInt(respondBtn.dataset.index, 10);
      const submissionId = els.resultPanel.dataset.submissionId;
      const submission = ctx.state.submissions.find((s) => s.id === submissionId);
      if (!submission) return;

      const qs = submission.questionScores[idx];
      const newScoreStr = prompt(`Re-evaluasi Soal ${idx + 1} (skor saat ini: ${qs.score}):\nMasukkan skor baru (0-100):`, qs.score);
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

      submission.finalScore = Math.round(
        submission.questionScores.reduce((acc, curr) => acc + curr.score, 0) / submission.questionScores.length
      );

      try {
        await saveSubmissionToDatabase(submission);
        showToast("Re-evaluasi berhasil disimpan", "success");
        showResult(els, submission, ctx.auth);
        renderMonitoring(els, ctx.state);
        renderStudentHistory(els, ctx.state.submissions, ctx.auth.user.name);
      } catch (err) {
        showToast(err.message, "error");
      }
      return;
    }

    // Teacher rejects a complaint: score is automatically reduced by 20.
    const rejectBtn = e.target.closest(".reject-complaint-btn");
    if (rejectBtn) {
      const idx = parseInt(rejectBtn.dataset.index, 10);
      const submissionId = els.resultPanel.dataset.submissionId;
      const submission = ctx.state.submissions.find((s) => s.id === submissionId);
      if (!submission) return;

      const qs = submission.questionScores[idx];
      const newScore = Math.max(0, qs.score - 20);
      const response = prompt(`Tolak komplain untuk Soal ${idx + 1}?\n\nSkor akan dikurangi 20 poin: ${qs.score} → ${newScore}\n\nTuliskan penjelasan untuk siswa (opsional):`, "");
      if (response === null) return;

      qs.score = newScore;
      qs.complaint = {
        ...qs.complaint,
        status: "rejected",
        response: String(response || "").trim(),
        resolvedAt: new Date().toISOString(),
      };

      submission.finalScore = Math.round(
        submission.questionScores.reduce((acc, curr) => acc + curr.score, 0) / submission.questionScores.length
      );

      try {
        await saveSubmissionToDatabase(submission);
        showToast("Komplain ditolak. Skor dikurangi 20 poin.", "success");
        showResult(els, submission, ctx.auth);
        renderMonitoring(els, ctx.state);
        renderStudentHistory(els, ctx.state.submissions, ctx.auth.user.name);
      } catch (err) {
        showToast(err.message, "error");
      }
      return;
    }

    const editBtn = e.target.closest(".edit-override-btn");
    if (!editBtn) return;
    const idx = parseInt(editBtn.dataset.index, 10);
    const submissionId = els.resultPanel.dataset.submissionId;
    const submission = ctx.state.submissions.find((s) => s.id === submissionId);
    if (!submission) return;

    const qs = submission.questionScores[idx];
    const newScoreStr = prompt("Masukkan skor baru (0-100):", qs.score);
    if (newScoreStr === null) return;

    const scoreVal = parseInt(newScoreStr, 10);
    if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 100) {
      showToast("Skor tidak valid. Harus angka 0-100", "error");
      return;
    }

    const newFeedback = prompt("Tambahkan / ubah catatan kelemahan (opsional):", qs.gaps?.join(" ") || "");
    if (newFeedback !== null) {
      qs.gaps = [newFeedback];
    }
    qs.score = scoreVal;

    submission.finalScore = Math.round(
      submission.questionScores.reduce((acc, curr) => acc + curr.score, 0) / submission.questionScores.length
    );

    try {
      await saveSubmissionToDatabase(submission);
      showToast("Koreksi berhasil disimpan", "success");
      showResult(els, submission, ctx.auth);
      renderMonitoring(els, ctx.state);
      renderStudentHistory(els, ctx.state.submissions, ctx.auth.user.name);
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  if (els.downloadClassCsvBtn) {
    els.downloadClassCsvBtn.addEventListener("click", () => {
      downloadClassCsv(ctx);
    });
  }

  els.assessmentList.addEventListener("click", async (event) => {
    const article = event.target.closest("article");
    if (!article) return;
    const id = article.dataset.id;
    const assessment = ctx.state.assessments.find((a) => a.id === id);
    if (!assessment) return;

    if (event.target.classList.contains("more-menu-trigger")) {
      const menu = event.target.closest(".more-menu");
      const dropdown = menu.querySelector(".more-menu-dropdown");
      const isHidden = dropdown.classList.toggle("hidden");
      event.target.setAttribute("aria-expanded", String(!isHidden));
      document.querySelectorAll(".more-menu-dropdown:not(.hidden)").forEach((d) => {
        if (d !== dropdown) d.classList.add("hidden");
      });
      return;
    }
    if (event.target.classList.contains("close-assessment")) {
      const studentSubmissions = ctx.state.submissions.filter((s) => s.assessmentId === id);
      const impact = studentSubmissions.length
        ? `${studentSubmissions.length} siswa sudah mengumpulkan. Nilai mereka tetap tersimpan, tetapi siswa lain tidak bisa memulai penilaian ini.`
        : "Belum ada siswa yang mengumpulkan. Siswa tidak akan bisa memulai penilaian ini.";
      const proceed = await showConfirmDialog(`Tutup akses siswa para penilaian ini?\n\n${impact}\n\nAnda bisa membukanya kembali kapan saja.`, "Tutup Penilaian");
      if (!proceed) return;
      await updateAssessment(id, { status: "closed", classId: assessment.classId });
      await reloadState(ctx);
      await renderCurrentState(ctx);
      showToast("Akses siswa ditutup. Siswa tidak bisa memulai penilaian ini.", "success");
    } else if (event.target.classList.contains("reopen-assessment")) {
      await updateAssessment(id, { status: "published", classId: assessment.classId });
      await reloadState(ctx);
      await renderCurrentState(ctx);
      showToast("Akses siswa dibuka kembali.", "success");
    } else if (event.target.classList.contains("delete-assessment")) {
      if (!await showConfirmDialog("Hapus penilaian beserta semua submission? Tindakan ini tidak bisa dibatalkan.", "Hapus Penilaian")) return;
      await deleteAssessment(id);
      await reloadState(ctx);
      await renderCurrentState(ctx);
    } else if (event.target.classList.contains("edit-assessment")) {
      ctx.pendingAssessmentConfig = {
        id: assessment.id,
        topic: assessment.topic,
        difficulty: assessment.difficulty,
        classId: assessment.classId,
        outcomes: assessment.outcomes,
        rubric: assessment.rubric,
        oralExamEnabled: assessment.oralExamEnabled !== false,
        disableManualTyping: !!assessment.disableManualTyping,
        allowRetakes: !!assessment.allowRetakes,
      };
      ctx.pendingQuestions = assessment.questions;
      const { goToWizardStep, renderQuestionEditor } = await import("./assessment-wizard.js");
      renderQuestionEditor(ctx);
      goToWizardStep(ctx, 2);
      await switchView(ctx, "teacherView");
      els.questionEditor.scrollIntoView({ behavior: "smooth" });
    } else if (event.target.classList.contains("download-grades-assessment")) {
      downloadAssessmentGrades(ctx, assessment);
    }
  });
}

function downloadAssessmentGrades(ctx, assessment) {
  const assessmentSubmissions = ctx.state.submissions.filter((s) => s.assessmentId === assessment.id);
  if (!assessmentSubmissions.length) {
    showToast("Belum ada nilai/submission para assessment ini.", "error");
    return;
  }

  const latestSubmissionsMap = new Map();
  assessmentSubmissions.forEach((sub) => {
    const key = sub.studentName;
    const existing = latestSubmissionsMap.get(key);
    if (!existing || new Date(sub.submittedAt) > new Date(existing.submittedAt)) {
      latestSubmissionsMap.set(key, sub);
    }
  });

  const latestSubmissions = Array.from(latestSubmissionsMap.values());
  latestSubmissions.sort((a, b) => a.studentName.localeCompare(b.studentName));

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvRows = [];
  csvRows.push(["Nama Siswa", "Email", "Skor Akhir", "Tanggal Pengerjaan"].map(escapeCsv).join(","));

  latestSubmissions.forEach((sub) => {
    const membership = ctx.state.memberships.find(
      (m) => m.student_name === sub.studentName && m.class_id === assessment.classId
    );
    const email = membership ? membership.student_email || "-" : "-";

    const formattedDate = sub.submittedAt
      ? new Date(sub.submittedAt).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "-";

    csvRows.push([sub.studentName, email, sub.finalScore, formattedDate].map(escapeCsv).join(","));
  });

  const csvContent = "\uFEFF" + "sep=,\n" + csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);

  const safeTopicName = assessment.topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  link.setAttribute("download", `nilai_${safeTopicName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("CSV Nilai Assessment berhasil didownload.", "success");
}

function downloadClassCsv(ctx) {
  const { els } = ctx;
  const classId = els.monitorClassFilter?.value;
  if (!classId) {
    showToast("Pilih kelas terlebih dahulu para download nilai.", "error");
    return;
  }

  const selectedClass = ctx.state.classes.find((c) => c.id === classId);
  const className = selectedClass ? selectedClass.name : "Kelas";

  const classSubmissions = ctx.state.submissions.filter((s) => s.classId === classId);
  if (!classSubmissions.length) {
    showToast("Belum ada nilai/submission di kelas ini.", "error");
    return;
  }

  const latestSubmissionsMap = new Map();
  classSubmissions.forEach((sub) => {
    const key = `${sub.studentName}_${sub.assessmentId}`;
    const existing = latestSubmissionsMap.get(key);
    if (!existing || new Date(sub.submittedAt) > new Date(existing.submittedAt)) {
      latestSubmissionsMap.set(key, sub);
    }
  });

  const latestSubmissions = Array.from(latestSubmissionsMap.values());

  latestSubmissions.sort((a, b) => {
    const nameCompare = a.studentName.localeCompare(b.studentName);
    if (nameCompare !== 0) return nameCompare;
    return a.assessmentTitle.localeCompare(b.assessmentTitle);
  });

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvRows = [];
  csvRows.push(["Nama Siswa", "Email", "Topik Assessment", "Skor Akhir", "Tanggal Pengerjaan"].map(escapeCsv).join(","));

  latestSubmissions.forEach((sub) => {
    const membership = ctx.state.memberships.find(
      (m) => m.student_name === sub.studentName && m.class_id === classId
    );
    const email = membership ? membership.student_email || "-" : "-";

    const formattedDate = sub.submittedAt
      ? new Date(sub.submittedAt).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "-";

    csvRows.push([sub.studentName, email, sub.assessmentTitle, sub.finalScore, formattedDate].map(escapeCsv).join(","));
  });

  const csvContent = "\uFEFF" + "sep=,\n" + csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);

  const safeClassName = className
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  link.setAttribute("download", `nilai_${safeClassName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast("CSV berhasil didownload.", "success");
}

async function reloadState(ctx) {
  const { loadState } = await import("./storage.js");
  const nextState = await loadState();
  ctx.state.assessments = nextState.assessments;
  ctx.state.submissions = nextState.submissions;
  ctx.state.classes = nextState.classes;
  ctx.state.memberships = nextState.memberships;
}