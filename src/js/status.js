import { escapeHtml } from "./utils.js";

/**
 * Assessment status model (PRD §7).
 *
 * Only EVALUATED submissions contribute to academic score aggregates.
 * FAILED / EVALUATING / NOT_COMPLETED must never render as score 0.
 */
export const ASSESSMENT_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  STARTED: "STARTED",
  SUBMITTED: "SUBMITTED",
  EVALUATING: "EVALUATING",
  EVALUATED: "EVALUATED",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  FAILED: "FAILED",
  NOT_COMPLETED: "NOT_COMPLETED",
};

export const STATUS_LABELS = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  STARTED: "Dimulai",
  SUBMITTED: "Terkumpul",
  EVALUATING: "Menilai…",
  EVALUATED: "Evaluated",
  NEEDS_REVIEW: "Needs Review",
  FAILED: "Gagal",
  NOT_COMPLETED: "Belum Selesai",
};

/**
 * Resolve the effective submission status. Legacy submissions (created before
 * the status model) that carry a numeric score behave as EVALUATED.
 */
export function getSubmissionStatus(submission) {
  if (!submission) return ASSESSMENT_STATUS.NOT_COMPLETED;
  if (submission.status) return submission.status;
  if (typeof submission.finalScore === "number" && Number.isFinite(submission.finalScore)) {
    return ASSESSMENT_STATUS.EVALUATED;
  }
  return ASSESSMENT_STATUS.NOT_COMPLETED;
}

export function isEvaluatedEffective(submission) {
  return getSubmissionStatus(submission) === ASSESSMENT_STATUS.EVALUATED;
}

export function hasValidScore(submission) {
  if (!isEvaluatedEffective(submission)) return false;
  return typeof submission.finalScore === "number" && Number.isFinite(submission.finalScore);
}

/**
 * Score for aggregates. Returns null when the submission must not contribute
 * a numeric score (PRD: technical failures never become score 0).
 */
export function aggregateScoreOf(submission) {
  return hasValidScore(submission) ? submission.finalScore : null;
}

export function statusLabel(status) {
  return STATUS_LABELS[status] || status || "-";
}

/** Human label + badge class for a submission status (accessible, not color-only). */
export function statusBadgeInfo(status) {
  const map = {
    EVALUATED: { label: "✓ Evaluated", cls: "status-evaluated", title: "Hasil tervalidasi" },
    NEEDS_REVIEW: { label: "⚠ Needs Review", cls: "status-review", title: "Perlu tinjauan" },
    FAILED: { label: "✕ Evaluasi Gagal", cls: "status-failed", title: "Evaluasi tidak tersedia" },
    EVALUATING: { label: "Menilai…", cls: "status-evaluating", title: "Sedang dievaluasi" },
    NOT_COMPLETED: { label: "— Belum Selesai", cls: "status-incomplete", title: "Belum dikumpulkan" },
    PUBLISHED: { label: "Published", cls: "status-published", title: "Diterbitkan" },
    DRAFT: { label: "Draft", cls: "status-draft", title: "Draf" },
    STARTED: { label: "Dimulai", cls: "status-started", title: "Dikerjakan" },
    SUBMITTED: { label: "Terkumpul", cls: "status-submitted", title: "Menunggu evaluasi" },
  };
  return map[status] || { label: statusLabel(status), cls: "status-muted", title: statusLabel(status) };
}

export function renderStatusBadge(status) {
  const info = statusBadgeInfo(status);
  return `<span class="status-badge ${info.cls}" title="${escapeHtml(info.title || info.label)}">${info.label}</span>`;
}