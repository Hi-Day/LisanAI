import { getSubmissionDetail, validateScores } from "./api.js";
import { setButtonLoading } from "./dom.js";
import { showResult } from "./render.js";
import { renderCurrentState } from "./app-context.js";
import { isAwaitingValidation, statusLabel } from "./status.js";
import { showConfirmDialog, showToast } from "./toast.js";
import { escapeHtml } from "./utils.js";

/**
 * Lecturer score validation ("Validasi Nilai").
 * AI scores stay hidden from students until validated here; validation releases the score
 * and queues it for BINUS Maya (LTI Basic Outcomes) when the attempt was launched from there.
 * Corrections reuse the existing "Koreksi" action inside the result detail.
 */
export function bindScoreValidationEvents(ctx) {
  const list = ctx.els.scoreValidationList;
  if (!list) return;

  // A correction made in the result detail ("Koreksi") changes the score shown here.
  ctx.els.resultPanel?.addEventListener("click", (event) => {
    if (event.target.closest(".close-result-btn") && ctx.currentViewId === "scoreValidationView") renderScoreValidation(ctx);
  });

  list.addEventListener("click", async (event) => {
    const reviewBtn = event.target.closest(".sv-review-btn");
    if (reviewBtn) {
      await openForReview(ctx, reviewBtn.dataset.id);
      return;
    }

    const validateBtn = event.target.closest(".sv-validate-btn");
    if (validateBtn) {
      await runValidation(ctx, [validateBtn.dataset.id], validateBtn, "Validasi");
      return;
    }

    const allBtn = event.target.closest(".sv-validate-all-btn");
    if (allBtn) {
      const group = collectPendingGroups(ctx).find((item) => item.assessmentId === allBtn.dataset.assessmentId);
      if (!group) return;
      const flagged = group.items.filter((item) => item.status === "NEEDS_REVIEW").length;
      const message = `Validasi ${group.items.length} nilai untuk "${group.title}"?\n\n`
        + "Mahasiswa akan langsung melihat nilainya, dan nilai dikirim ke BINUS Maya bila penilaian dibuka dari sana."
        + (flagged ? `\n\n${flagged} nilai ditandai AI perlu tinjauan. Pastikan sudah ditinjau atau dikoreksi.` : "");
      if (!(await showConfirmDialog(message, "Validasi semua nilai"))) return;
      await runValidation(ctx, group.items.map((item) => item.id), allBtn, `Validasi semua (${group.items.length})`);
    }
  });
}

async function openForReview(ctx, submissionId) {
  const summary = ctx.state.submissions.find((item) => item.id === submissionId);
  if (!summary) return;
  let submission = summary;
  try {
    submission = await getSubmissionDetail(submissionId);
  } catch {
    // The state copy is enough to review and correct the score.
  }
  showResult(ctx.els, submission, ctx.auth);
}

async function runValidation(ctx, ids, button, defaultText) {
  setButtonLoading(button, true, "Memvalidasi…", defaultText);
  try {
    const result = await validateScores(ids);
    const validated = new Set([...(result.validated || []), ...(result.alreadyValidated || [])]);
    for (const submission of ctx.state.submissions) {
      if (!validated.has(submission.id)) continue;
      submission.status = "EVALUATED";
      submission.scoreRelease = { status: "released", validatedBy: ctx.auth.user.id, validatedAt: new Date().toISOString() };
    }
    showToast(describeResult(result), "success");
    renderCurrentState(ctx);
    renderScoreValidation(ctx);
  } catch (error) {
    showToast(error.message || "Gagal memvalidasi nilai", "error");
    setButtonLoading(button, false, "", defaultText);
  }
}

function describeResult(result) {
  const count = (result.validated || []).length;
  let text = count ? `${count} nilai divalidasi dan kini terlihat oleh mahasiswa.` : "Nilai sudah divalidasi sebelumnya.";
  if (result.queuedForLms) {
    const deliveries = result.lmsDelivery?.results || [];
    const failed = deliveries.filter((item) => !item.ok).length;
    text += failed || result.lmsDelivery?.error
      ? ` Pengiriman ${result.queuedForLms} nilai ke BINUS Maya belum berhasil dan akan dicoba ulang otomatis.`
      : ` ${result.queuedForLms} nilai dikirim ke BINUS Maya.`;
  }
  return text;
}

export function collectPendingGroups(ctx) {
  const groups = new Map();
  for (const submission of ctx.state.submissions || []) {
    if (!isAwaitingValidation(submission)) continue;
    const key = submission.assessmentId || "unknown";
    const group = groups.get(key) || {
      assessmentId: key,
      title: submission.assessmentTitle || "Penilaian",
      items: [],
      latest: "",
    };
    group.items.push(submission);
    if ((submission.submittedAt || "") > group.latest) group.latest = submission.submittedAt || "";
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => ({ ...group, items: group.items.sort((a, b) => String(a.studentName).localeCompare(String(b.studentName))) }))
    .sort((a, b) => b.latest.localeCompare(a.latest));
}

export function renderScoreValidation(ctx) {
  const { els } = ctx;
  if (!els.scoreValidationList) return;
  const groups = collectPendingGroups(ctx);
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  if (els.scoreValidationCount) els.scoreValidationCount.textContent = String(total);
  updateScoreValidationBadge(total);

  if (!groups.length) {
    els.scoreValidationList.innerHTML = `
      <div class="analytics-panel">
        <div class="empty-state" role="status">
          <strong>Semua nilai sudah divalidasi</strong>
          <p>Nilai baru muncul di sini setelah mahasiswa menyelesaikan ujian.</p>
        </div>
      </div>`;
    return;
  }

  els.scoreValidationList.innerHTML = groups.map(renderGroup).join("");
}

function renderGroup(group) {
  return `
    <section class="analytics-panel wide score-validation-group" aria-label="${escapeHtml(group.title)}">
      <div class="score-validation-group-head">
        <div>
          <h3>${escapeHtml(group.title)}</h3>
          <p>${group.items.length} nilai menunggu validasi</p>
        </div>
        <button type="button" class="primary-button sv-validate-all-btn" data-assessment-id="${escapeHtml(group.assessmentId)}">Validasi semua (${group.items.length})</button>
      </div>
      <div class="table-container" style="overflow-x: auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Mahasiswa</th>
              <th>Dikumpulkan</th>
              <th>Skor AI</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>${group.items.map(renderRow).join("")}</tbody>
        </table>
      </div>
    </section>`;
}

function renderRow(submission) {
  const date = submission.submittedAt
    ? new Date(submission.submittedAt).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "-";
  const needsReview = submission.status === "NEEDS_REVIEW";
  const statusHtml = needsReview
    ? `<span class="tag badge-review" title="AI menandai jawaban ini perlu ditinjau sebelum divalidasi">⚠ Perlu tinjauan</span>`
    : `<span class="tag badge-ai" title="Dinilai AI, belum divalidasi dosen">${escapeHtml(statusLabel(submission.status) === "Evaluated" ? "Dinilai AI" : statusLabel(submission.status))}</span>`;
  const score = Number.isFinite(Number(submission.finalScore)) ? submission.finalScore : "—";
  return `
    <tr data-id="${escapeHtml(submission.id)}">
      <td data-label="Mahasiswa"><strong>${escapeHtml(submission.studentName || "-")}</strong></td>
      <td data-label="Dikumpulkan">${escapeHtml(date)}</td>
      <td data-label="Skor AI"><span class="metric-pill" style="padding: 4px 12px;">${escapeHtml(String(score))}</span></td>
      <td data-label="Status">${statusHtml}</td>
      <td data-label="Aksi">
        <div class="item-actions">
          <button type="button" class="secondary-button sv-review-btn" data-id="${escapeHtml(submission.id)}">Tinjau / Koreksi</button>
          <button type="button" class="primary-button sv-validate-btn" data-id="${escapeHtml(submission.id)}">Validasi</button>
        </div>
      </td>
    </tr>`;
}

function updateScoreValidationBadge(total) {
  const badge = document.getElementById("scoreValidationNavBadge");
  if (!badge) return;
  badge.textContent = String(total);
  badge.classList.toggle("hidden", total === 0);
}
