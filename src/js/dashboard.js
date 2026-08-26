import { showToast } from "./toast.js";
import { escapeHtml, compactText } from "./utils.js";
import {
  getSubmissionStatus,
  hasValidScore,
  renderStatusBadge,
} from "./status.js";
import { renderAssessmentItem, renderRubricTable } from "./render.js";
import { buildCompetencyProfile, renderCompetencyClass, renderCompetencyStudent, parseRubricToCriteria } from "./competency-profile.js";
import { switchView } from "./app-context.js";
import { getSubmissionDetail } from "./api.js";

/**
 * Trustworthy assessment intelligence dashboard (PRD UX v1.0).
 *
 * Monitor → Identify → Investigate → Review → Intervene.
 * Only EVALUATED submissions contribute to score aggregates.
 */

const ATTENTION_SCORE_THRESHOLD = 70;
const ATTENTION_TREND_THRESHOLD = -15;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Resolve a CSS custom property from :root so inline SVGs follow the theme. */
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function bindDashboardEvents(ctx) {
  const { els } = ctx;

  els.dashboardClassFilter?.addEventListener("change", () => renderDashboard(ctx));
  els.dashboardRangeFilter?.addEventListener("change", () => renderDashboard(ctx));

  els.profileStudentSelect?.addEventListener("change", (e) => {
    if (e.target.value) {
      ctx.profileSelectedStudent = e.target.value;
      renderStudentProfile(ctx, e.target.value, ctx.currentDetailReturnView);
    }
  });

  els.detailBackBtn?.addEventListener("click", () => {
    const target = ctx.currentDetailReturnView || "dashboardView";
    switchView(ctx, target);
  });

  els.assessmentTabFilter?.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-filter-btn");
    if (!btn) return;
    els.assessmentTabFilter.querySelectorAll(".tab-filter-btn").forEach((b) => {
      const active = b === btn;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", String(active));
    });
    renderAssessmentsWithTab(ctx);
  });

  els.assessmentListView?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-nav-view]");
    if (btn) switchView(ctx, btn.dataset.navView);
  });

  els.recentAssessmentsList?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-open-detail]");
    if (!btn) return;
    await openAssessmentDetail(ctx, btn.dataset.openDetail);
  });

  els.atRiskList?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-open-profile]");
    if (!btn) return;
    openStudentProfile(ctx, btn.dataset.openProfile);
  });

  els.assessmentDetailContent?.addEventListener("click", async (e) => {
    const traceBtn = e.target.closest("#loadTraceBtn");
    if (traceBtn) {
      await loadAssessmentTrace(ctx);
      return;
    }
    const profileBtn = e.target.closest("[data-open-profile]");
    if (profileBtn) {
      openStudentProfile(ctx, profileBtn.dataset.openProfile);
    }
  });

  els.studentProfileContent?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-open-detail]");
    if (!btn) return;
    await openAssessmentDetail(ctx, btn.dataset.openDetail, "studentProfileView");
  });
}

export async function renderDashboard(ctx) {
  const { els, state } = ctx;
  const classId = els.dashboardClassFilter.value || "";
  const range = els.dashboardRangeFilter.value || "30";
  const rangeDays = range === "all" ? null : Number(range);

  populateClassFilter(ctx, els.dashboardClassFilter, classId);

  const klass = classId ? state.classes.find((c) => c.id === classId) : null;
  els.dashboardSubtitle.textContent = klass ? klass.name : "Semua Kelas";

  const scope = filterScope(ctx, classId, rangeDays);
  const assigned = assignedStudentCount(ctx, state.memberships, classId, scope);

  renderSkeleton(els.dashboardKpis, 4);
  renderSkeleton(els.performanceChart, 1, 220);
  renderSkeleton(els.scoreDistribution, 1, 180);
  renderSkeleton(els.competencyOverview, 1, 160);
  renderSkeleton(els.atRiskList, 1, 120);
  els.recentAssessmentsList.innerHTML =
    '<tr><td colspan="6" class="empty-state">Memuat…</td></tr>';

  await new Promise((r) => setTimeout(r, 60));

  const evaluated = scope.filter(hasValidScore);
  const avg = evaluated.length
    ? Math.round(evaluated.reduce((a, s) => a + s.finalScore, 0) / evaluated.length)
    : null;

  const profiles = buildStudentProfiles(scope);
  const atRisk = profiles.filter((p) => p.atRisk);

  const completionRate = assigned
    ? Math.min(100, Math.round((evaluated.length / Math.max(assigned, evaluated.length)) * 100))
    : 0;

  els.dashboardKpis.innerHTML = [
    kpiCard(
      "Pengumpulan",
      scope.length,
      "submission",
      "Total submission dalam rentang terpilih"
    ),
    kpiCard(
      "Rata-rata Skor",
      avg === null ? "—" : String(avg),
      "Evaluated",
      "Hanya penilaian tervalidasi (EVALUATED) yang dihitung"
    ),
    kpiCard(
      "Tingkat Penyelesaian",
      `${completionRate}%`,
      "completed / assigned",
      "Submission tervalidasi dibagi siswa yang ditugaskan"
    ),
    kpiCard(
      "Perlu Perhatian",
      String(atRisk.length),
      "siswa",
      "Skor rendah, tren menurun, atau kelemahan kompetensi berulang"
    ),
  ].join("");

  els.atRiskCount.textContent = `${atRisk.length} siswa`;

  renderTrendChart(els.performanceChart, evaluated);
  renderDistribution(els.scoreDistribution, evaluated);
  renderCompetencies(els.competencyOverview, state.assessments, evaluated);
  renderAtRisk(els.atRiskList, atRisk);
  renderCompTrend(ctx, evaluated);
  renderRecentAssessments(els.recentAssessmentsList, recentSubmissions(scope, 8));
}

export function openStudentProfile(ctx, studentName) {
  if (!studentName) return;
  ctx.profileSelectedStudent = studentName;
  ctx.currentDetailReturnView = "dashboardView";
  renderStudentProfile(ctx, studentName);
  switchView(ctx, "studentProfileView");
}

export async function renderStudentProfile(ctx, studentName, returnView = "dashboardView") {
  const { els, state } = ctx;
  const allSubs = state.submissions.filter((s) => s.studentName === studentName);
  const evaluated = allSubs
    .filter(hasValidScore)
    .slice()
    .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));

  const avg = evaluated.length
    ? Math.round(evaluated.reduce((a, s) => a + s.finalScore, 0) / evaluated.length)
    : null;
  const last = evaluated.at(-1);
  const first = evaluated[0];
  const improvement = evaluated.length > 1 && last && first ? last.finalScore - first.finalScore : null;

  els.studentProfileContent.innerHTML = `
    <div class="kpi-grid">
      ${kpiCard("Rata-rata Skor", avg === null ? "—" : String(avg), "evaluasi tervalidasi")}
      ${kpiCard("Penilaian", String(evaluated.length), "dari " + allSubs.length + " pengumpulan")}
      ${kpiCard("Perbaikan", improvement === null ? "—" : `${improvement >= 0 ? "+" : ""}${improvement}`, "skor awal → terakhir")}
      ${kpiCard("Penilaian Terakhir", last ? String(last.finalScore) : "—", last ? compactText(last.assessmentTitle, 28) : "belum ada")}
    </div>
    <div class="analytics-panel wide">
      <h3>Tren Performa</h3>
      ${evaluated.length ? buildProfileTrend(evaluated) : `<p class="empty-state">Belum ada evaluasi tervalidasi.</p>`}
    </div>
    <div class="analytics-panel wide">
      <h3>Profil Kompetensi</h3>
      ${renderCompetencyStudent(buildCompetencyProfile(ctx.state.assessments, evaluated))}
    </div>
    <div class="analytics-panel wide">
      <h3>Riwayat Penilaian</h3>
      <div class="table-container" style="overflow-x:auto;">
        <table class="data-table">
          <thead><tr><th>Penilaian</th><th>Tanggal</th><th>Skor</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            ${allSubs.slice().reverse().map((s) => `
              <tr class="submission-row" data-id="${s.id}">
                <td data-label="Penilaian"><strong>${escapeHtml(s.assessmentTitle)}</strong></td>
                <td data-label="Tanggal">${formatDate(s.submittedAt)}</td>
                <td data-label="Skor">${hasValidScore(s) ? s.finalScore : "—"}</td>
                <td data-label="Status">${renderStatusBadge(getSubmissionStatus(s))}</td>
                <td data-label="Aksi">
                  <button type="button" class="secondary-button view-submission-btn" data-open-detail="${escapeHtml(s.id)}">View</button>
                </td>
              </tr>`).join("") || `<tr><td colspan="5" class="empty-state">Belum ada penilaian untuk siswa ini.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ---- Assessment Detail ---------------------------------------------------

export async function openAssessmentDetail(ctx, submissionId, fromView = "dashboardView") {
  const summary = ctx.state?.submissions?.find((s) => s.id === submissionId);
  if (!summary) {
    showToast("Penilaian tidak ditemukan.", "error");
    return;
  }
  let submission = summary;
  try {
    submission = await getSubmissionDetail(submissionId);
  } catch {
    // Fall back to the in-state summary so the detail view still renders.
  }
  const { els } = ctx;
  ctx.currentDetailSubmissionId = submission.id;
  ctx.currentDetailReturnView = fromView;
  els.assessmentDetailContent.innerHTML = renderSkeletonLines(4);
  switchView(ctx, "assessmentDetailView");
  renderAssessmentDetail(ctx, submission);
}

function renderAssessmentDetail(ctx, submission) {
  const { els, state } = ctx;
  const status = getSubmissionStatus(submission);
  const evaluated = hasValidScore(submission);
  const verification = submission.verification || null;
  const criteria = Array.isArray(submission.criteria) ? submission.criteria : [];
  const confidence = criteriaAvgConfidence(criteria);
  const confidencePct = confidence === null ? null : `${Math.round(confidence * 100)}%`;
  const coverage = verification?.scoreConsistency?.coverage ?? criteriaCoverage(criteria);
  const coveragePct = coverage === null ? null : `${Math.round(coverage * 100)}%`;
  const scoredCriteria = criteria.filter((c) => Number.isFinite(Number(c.score))).length;
  const rubricPct = criteria.length ? Math.round((scoredCriteria / criteria.length) * 100) : null;
  const verStatus = verification?.status || (verification?.valid === false ? "FAIL" : verification ? "PASS" : null);

  // Find the assessment to get per-question rubrics
  const assessment = state.assessments.find((a) => a.id === submission.assessmentId);
  const rubricHtml = assessment && Array.isArray(assessment.questions)
    ? assessment.questions.map((q, i) => {
        const rubricText = q.rubric || "";
        if (!rubricText) return "";
        return `
          <div class="analytics-panel" style="margin-top:16px;">
            <h4>Soal ${i + 1}: ${escapeHtml(q.prompt || "")}</h4>
            ${renderRubricTable(rubricText)}
          </div>`;
      }).filter(Boolean).join("")
    : "";

  const detailMeta = `
    <div class="detail-hero">
      <div class="detail-hero-main">
        <p class="eyebrow">Assessment Detail</p>
        <h3>${escapeHtml(submission.assessmentTitle)}</h3>
        <div class="detail-meta">
          <span><strong>Siswa:</strong>
            <button type="button" class="link-button" data-open-profile="${escapeHtml(submission.studentName)}">${escapeHtml(submission.studentName)}</button>
          </span>
          <span><strong>Tanggal:</strong> ${formatDateTime(submission.submittedAt)}</span>
          <span><strong>Status:</strong> ${renderStatusBadge(status)}</span>
          <span><strong>Sumber:</strong> ${submission.evaluationSource === "fallback" ? "Evaluasi lokal (deterministik)" : "AI Harness"}</span>
        </div>
      </div>
      <div class="detail-score-block">
        ${evaluated
          ? `<div class="score-badge">${submission.finalScore}<span class="score-max">/100</span></div>`
          : `<div class="score-badge score-muted">—</div>`}
        <div class="detail-trust-row">
          ${confidencePct ? `<span class="trust-chip">Confidence ${confidencePct}</span>` : ""}
          ${coveragePct ? `<span class="trust-chip">Bukti grounded ${coveragePct}</span>` : ""}
          ${rubricPct !== null ? `<span class="trust-chip">Cakupan rubrik ${rubricPct}%</span>` : ""}
        </div>
        ${verification ? `<div class="verification-mini">${verificationBadge(verStatus)}</div>` : ""}
      </div>
    </div>
  `;

  const criteriaHtml = criteria.length
    ? `<div class="analytics-panel">
        <div class="panel-head-row">
          <h3 style="margin:0;">Criterion</h3>
          <span class="metric-pill">${criteria.length} kriteria</span>
        </div>
        <p class="panel-hint">Skor per kriteria rubrik, dengan bukti yang dapat ditelusuri ke jawaban siswa.</p>
        <div class="criterion-stack">${criteria.map((c, i) => renderCriterion(c, i, rubricNameMap(assessment))).join("")}</div>
      </div>`
    : `<div class="analytics-panel"><h3>Criterion</h3><div class="empty-state">Belum ada data kriteria — gunakan evaluasi berbasis rubrik (AI Harness).</div></div>`;

  const traceHtml = `
    <div class="analytics-panel">
      <div class="panel-head-row">
        <h3 style="margin:0;">Jejak Penilaian (Trace)</h3>
        ${submission.evaluationRunId
          ? `<button class="secondary-button" id="loadTraceBtn" type="button" style="min-height:36px;font-size:0.9rem;">Lihat Trace</button>`
          : `<span class="metric-pill">lokal</span>`}
      </div>
      <p class="panel-hint">Alur teknis evaluasi: model → rubrik → evidence → verifikasi → skor deterministik.</p>
      <div id="traceContent"></div>
    </div>
  `;

  els.assessmentDetailContent.innerHTML = `
    ${detailMeta}
    ${criteriaHtml}
    ${rubricHtml}
    ${traceHtml}
  `;
}

function renderCriterion(c, index, nameMap = new Map()) {
  const score = Number(c.score);
  const name = resolveCriterionName(c, index, nameMap);
  const evidence = Array.isArray(c.evidence) ? c.evidence : [];
  const grounded = evidence.some((ev) => ev && ev.grounded === true);
  const hasUngrounded = evidence.some((ev) => ev && ev.grounded === false);

  const evidenceHtml = evidence.length
    ? `<div class="criterion-evidence">
        <span class="evidence-status ${grounded ? "evidence-grounded" : "evidence-review"}">
          ${grounded ? "✓ Grounded" : hasUngrounded ? `⚠ ${evidence.filter((ev) => ev && ev.grounded === false).length} perlu tinjauan` : "✓ Grounded"}
        </span>
        <ul>
          ${evidence.map((ev) => `
            <li>
              <span class="evidence-quote">“${escapeHtmlSup(escapeHtml(compactText(String(ev.text || ""), 140)))}”</span>
              ${ev.grounded !== undefined && ev.grounded === false
            ? `<span class="evidence-tag tag-warn">tidak grounded</span>`
            : ""}
            </li>`).join("")}
        </ul>
      </div>`
    : `<p class="panel-hint">Tanpa evidence pada evaluasi ini.</p>`;

  const answerIndexText = c.answerIndex !== undefined && Number.isInteger(Number(c.answerIndex))
    ? `<span class="tag">Soal ${Number(c.answerIndex) + 1}</span>`
    : "";
  const weightText = c.weight ? `<span class="tag">bobot ${Math.round(Number(c.weight) * 100)}%</span>` : "";

  return `
    <article class="criterion-card">
      <div class="criterion-head">
        <div class="criterion-title">
          <strong>${escapeHtml(name)}</strong>
          <span>${answerIndexText}${weightText}</span>
        </div>
        <span class="criterion-score${Number.isFinite(score) && score < 70 ? " low" : ""}">
          ${Number.isFinite(score) ? score : "—"}<span class="font-max">/100</span>
        </span>
      </div>
      ${Number.isFinite(score) ? `<div class="meter"><span class="meter-fill" style="width:${Math.max(2, Math.min(100, score))}%"></span></div>` : ""}
      ${evidenceHtml}
      ${c.rationale ? `<p class="criterion-rationale"><span class="panel-hint">Alasan: </span>${formatRichText(c.rationale)}</p>` : ""}
    </article>
  `;
}

/**
 * Build a lookup of clean criterion names from the assessment's rubric(s).
 * Keys: criterionId (normalized) and criterion name (normalized) → display name.
 * The model/harness output sometimes stores the entire serialized rubric in the
 * criterion name; this lets the detail view show the actual criterion label
 * resolved from the rubric definition instead.
 */
function rubricNameMap(assessment) {
  const map = new Map();
  if (!assessment) return map;
  const push = (defs) => {
    (Array.isArray(defs) ? defs : []).forEach((c) => {
      if (!c || !c.name) return;
      if (c.id) map.set(`id:${normalizeKey(c.id)}`, c.name);
      map.set(`name:${normalizeKey(c.name)}`, c.name);
    });
  };
  if (assessment.rubric) push(parseRubricToCriteria(assessment.rubric));
  (Array.isArray(assessment.questions) ? assessment.questions : []).forEach((q) => {
    if (q && q.rubric) push(parseRubricToCriteria(q.rubric));
  });
  return map;
}

function normalizeKey(value) {
  return String(value == null ? "" : value).toLowerCase().trim();
}

function resolveCriterionName(c, index, nameMap) {
  const id = nameMap.get(`id:${normalizeKey(c.criterionId)}`);
  if (id) return id;
  const byName = c.name ? nameMap.get(`name:${normalizeKey(c.name)}`) : undefined;
  if (byName) return byName;
  if (c.name && looksLikeRubricDump(c.name)) {
    return prettifyId(c.criterionId) || `Kriteria ${index + 1}`;
  }
  return c.name || prettifyId(c.criterionId) || `Kriteria ${index + 1}`;
}

/** Heuristic: the stored "name" is actually a serialized rubric structure. */
function looksLikeRubricDump(value) {
  const s = String(value || "");
  if (s.length < 80) return false;
  return /\b(config|criteria\s+id|levels|descriptor)\b/i.test(s) && /\b(weight|score)\b/i.test(s);
}

async function loadAssessmentTrace(ctx) {
  const { els } = ctx;
  const submission = ctx.state?.submissions?.find((s) => s.id === ctx.currentDetailSubmissionId);
  const runId = submission?.evaluationRunId;
  const content = els.assessmentDetailContent?.querySelector("#traceContent");
  if (!runId || !content || content.dataset.loaded) return;
  content.innerHTML = `<p class="empty-state">Memuat jejak penilaian…</p>`;
  try {
    const res = await fetch(`/api/research?action=trace&runId=${encodeURIComponent(runId)}`, {
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Gagal memuat trace");
    content.innerHTML = renderTrace(data);
    content.dataset.loaded = "1";
  } catch (err) {
    content.innerHTML = `<p class="empty-state">Trace tidak tersedia: ${escapeHtml(err.message)}</p>`;
  }
}

function renderTrace(data) {
  const run = data.run;
  const versions = data.versions || {};
  const events = Array.isArray(data.events) ? data.events : [];
  const result = data.result || {};

  const metadata = [
    ["Model", result.versioning?.modelVersion || run?.model || versions.model_version || "-"],
    ["Provider", run?.model || "-"],
    ["Model Version", versions.model_version || result.versioning?.modelVersion || "-"],
    ["Rubric Version", versions.rubric_version || result.versioning?.rubricVersion || "-"],
    ["Harness Version", versions.harness_version || result.versioning?.harnessVersion || "-"],
    ["Prompt Version", versions.prompt_version || result.versioning?.promptVersion || "-"],
    ["Waktu Evaluasi", run?.created_at ? formatDateTime(run.created_at) : "-"],
  ];

  const hashes = [
    run?.prompt_hash && ["Prompt Hash", run.prompt_hash],
    run?.rubric_hash && ["Rubric Hash", run.rubric_hash],
    run?.input_hash && ["Input Hash", run.input_hash],
    run?.config_hash && ["Config Hash", run.config_hash],
  ].filter(Boolean);

  const steps = traceSteps(events);

  return `
    <div class="trace-steps">
      ${steps.length
    ? steps.map((s) => `<div class="trace-step"><span class="trace-step-arrow" aria-hidden="true">↓</span><span>${escapeHtml(s)}</span></div>`).join("")
    : `<p class="panel-hint">Belum ada event lengkap untuk run ini.</p>`}
    </div>
    <details class="trace-details">
      <summary>Metadata teknis &amp; versi</summary>
      <dl class="trace-meta">
        ${metadata.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join("")}
      </dl>
      ${hashes.length
    ? `<h4>Hash Reproduksibilitas</h4><dl class="trace-meta">${hashes.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd><code>${escapeHtml(v)}</code></dd></div>`).join("")}</dl>`
    : ""}
    </details>
  `;
}

const labels1 = {
  ASSESSMENT_LOADED: "Assessment Loaded",
  RUBRIC_LOADED: "Rubric Loaded",
  CONTEXT_BUILT: "Student Answer",
  EVIDENCE_EXTRACTED: "Evidence Extracted",
  VERIFICATION: "Verification",
  VERIFICATION_RUN: "Verification",
  FINAL_SCORE: "Deterministic Scoring → Final Score",
};

function traceSteps(events) {
  if (!events.length) return [];
  const map = new Map(events.map((ev) => [ev.type, true]));
  const steps = [];
  for (const type of ["ASSESSMENT_LOADED", "RUBRIC_LOADED", "CONTEXT_BUILT", "EVIDENCE_EXTRACTED", "VERIFICATION", "VERIFICATION_RUN", "FINAL_SCORE"]) {
    if (map.has(type) && labels1[type] && !steps.includes(labels1[type])) steps.push(labels1[type]);
  }
  if (!steps.length) return events.map((ev) => ev.type);
  return steps;
}

// ---- Dashboard charts ----------------------------------------------------

function renderTrendChart(el, submissions) {
  if (!submissions.length) {
    el.innerHTML = `<p class="empty-state">Belum ada penilaian tervalidasi di rentang ini.</p>`;
    return;
  }
  const sorted = submissions.slice().sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
  const first = new Date(sorted[0].submittedAt);
  const lastDate = new Date(sorted[sorted.length - 1].submittedAt);
  const bucketCount = Math.max(2, Math.min(12, Math.ceil((lastDate - first) / WEEK_MS) + 1));

  const buckets = Array.from({ length: bucketCount }, (_, i) => {
    const start = new Date(first.getTime() + i * WEEK_MS);
    const end = new Date(start.getTime() + WEEK_MS);
    const items = sorted.filter((s) => {
      const t = new Date(s.submittedAt).getTime();
      return t >= start.getTime() && t < end.getTime();
    });
    return {
      label: start.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      avg: items.length ? Math.round(items.reduce((a, s) => a + s.finalScore, 0) / items.length) : null,
      count: items.length,
    };
  });

  const W = 640;
  const H = 200;
  const padL = 34;
  const padR = 10;
  const padT = 14;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = buckets.length;
  const slot = innerW / n;
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));

  const band = (i) => padL + slot * i + slot / 2;
  const yFor = (v) => padT + innerH - (v / 100) * innerH;

  const barW = Math.min(26, slot * 0.4);
  const bars = buckets
    .map((b, i) => {
      const h = Math.max(2, (b.count / maxCount) * innerH);
      return `<rect x="${(band(i) - barW / 2).toFixed(1)}" y="${(padT + innerH - h).toFixed(1)}" width="${barW}" height="${h.toFixed(1)}" rx="3" fill="${cssVar("--brand-soft")}" />`;
    })
    .join("");

  const linePoints = buckets
    .map((b, i) => (b.avg === null ? null : `${band(i).toFixed(1)},${yFor(b.avg).toFixed(1)}`))
    .filter(Boolean);

  const line = linePoints.length > 1
    ? `<polyline points="${linePoints.join(" ")}" fill="none" stroke="${cssVar("--brand")}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`
    : "";
  const circles = buckets
    .map((b, i) => (b.avg === null ? "" : `<circle cx="${band(i).toFixed(1)}" cy="${yFor(b.avg).toFixed(1)}" r="3.5" fill="${cssVar("--brand")}"/>`))
    .join("");

  const gridLines = [0, 25, 50, 75, 100]
    .map((v) => `<line x1="${padL}" y1="${yFor(v)}" x2="${W - padR}" y2="${yFor(v)}" stroke="${cssVar("--border")}" stroke-width="1"/>`)
    .join("");
  const gridLabels = [0, 25, 50, 75, 100]
    .map((v) => `<text x="${padL - 6}" y="${yFor(v) + 4}" text-anchor="end" fill="${cssVar("--text-muted")}" font-size="10">${v}</text>`)
    .join("");
  const xLabels = buckets
    .map((b, i) => `<text x="${band(i)}" y="${H - 8}" text-anchor="middle" fill="${cssVar("--text-muted")}" font-size="9">${escapeXml(b.label)}</text>`)
    .join("");

  el.innerHTML = `
    <div class="chart-legend" aria-hidden="true">
      <span class="legend-item"><span class="legend-line"></span>Rata-rata skor</span>
      <span class="legend-item"><span class="legend-bar"></span>Jumlah submission</span>
    </div>
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tren rata-rata skor per minggu">
      ${gridLines}
      ${gridLabels}
      ${bars}
      ${line}
      ${circles}
      ${xLabels}
    </svg>
  `;
}

function renderDistribution(el, submissions) {
  if (!submissions.length) {
    el.innerHTML = `<p class="empty-state">Belum ada penilaian tervalidasi untuk ditampilkan.</p>`;
    return;
  }
  const buckets = [
    { label: "0–20", min: 0, max: 20 },
    { label: "21–40", min: 21, max: 40 },
    { label: "41–60", min: 41, max: 60 },
    { label: "61–80", min: 61, max: 80 },
    { label: "81–100", min: 81, max: 100 },
  ];
  const total = submissions.length;
  el.innerHTML = `
    <div class="dist-bars">
      ${buckets.map((b) => {
    const count = submissions.filter((s) => s.finalScore >= b.min && s.finalScore <= b.max).length;
    const pct = Math.round((count / total) * 100);
    return `
          <div class="dist-row">
            <span class="dist-label">${b.label}</span>
            <div class="dist-track"><span class="dist-fill" style="width:${pct}%"></span></div>
            <span class="dist-count">${count}</span>
          </div>`;
  }).join("")}
    </div>
  `;
}

function renderCompetencies(el, assessments, submissions) {
  const comps = buildCompetencyProfile(assessments, submissions);
  el.innerHTML = renderCompetencyClass(comps);
}

function renderAtRisk(el, atRisk) {
  if (!atRisk.length) {
    el.innerHTML = `
      <div class="empty-state ok-state">
        <span class="empty-state-icon" aria-hidden="true">✓</span>
        <div><strong>Tidak ada siswa yang perlu perhatian</strong><p>Semua siswa berada di atas ambang intervensi (${ATTENTION_SCORE_THRESHOLD}).</p></div>
      </div>`;
    return;
  }
  el.innerHTML = `
    <div class="table-container" style="overflow-x:auto;">
      <table class="data-table">
        <thead><tr><th>Siswa</th><th>Skor</th><th>Tren</th><th>Isu Utama</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>
          ${atRisk.slice(0, 8).map((p) => `
            <tr class="submission-row" data-id="${p.studentName}">
              <td data-label="Siswa"><strong>${escapeHtml(p.studentName)}</strong></td>
              <td data-label="Skor">${p.latest !== null ? p.latest : "—"}</td>
              <td data-label="Tren" class="${trendClass(p.trend)}">${trendArrow(p.trend)}</td>
              <td data-label="Isu Utama">${escapeHtml(p.mainIssue)}</td>
              <td data-label="Status"><span class="status-badge status-review">At Risk</span></td>
              <td data-label="Aksi">
                <button type="button" class="secondary-button view-submission-btn" data-open-profile="${escapeHtml(p.studentName)}">View</button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderRecentAssessments(el, subs) {
  if (!subs.length) {
    el.innerHTML = `<tr><td colspan="6" class="empty-state">Belum ada penilaian yang dikumpulkan siswa.</td></tr>`;
    return;
  }
  el.innerHTML = subs
    .map((s) => {
      const status = getSubmissionStatus(s);
      const actionLabel =
        status === "NEEDS_REVIEW" ? "Review" :
        status === "EVALUATING" ? "Lihat Progres" :
        status === "FAILED" ? "Retry / Review" : "View";
      return `
      <tr class="submission-row" data-id="${s.id}">
        <td data-label="Siswa"><strong>${escapeHtml(s.studentName)}</strong></td>
        <td data-label="Penilaian">${escapeHtml(s.assessmentTitle)}</td>
        <td data-label="Tanggal">${formatDate(s.submittedAt)}</td>
        <td data-label="Skor">${hasValidScore(s) ? s.finalScore : "—"}</td>
        <td data-label="Status">${renderStatusBadge(status)}</td>
        <td data-label="Aksi">
          <button type="button" class="secondary-button view-submission-btn" data-open-detail="${escapeHtml(s.id)}">${actionLabel}</button>
        </td>
      </tr>`;
    })
    .join("");
}

// ---- Data computation ----------------------------------------------------

function filterScope(ctx, classId, rangeDays) {
  let list = ctx.state.submissions;
  if (classId) list = list.filter((s) => s.classId === classId);
  if (rangeDays) {
    const cutoff = Date.now() - rangeDays * 86400000;
    list = list.filter((s) => new Date(s.submittedAt).getTime() >= cutoff);
  }
  return list;
}

function assignedStudentCount(ctx, memberships, classId, scope) {
  const names = new Set();
  memberships.forEach((m) => {
    if (m.status === "approved") {
      if (!classId || m.class_id === classId || m.classId === classId) {
        names.add(m.student_name || m.student_id);
      }
    }
  });
  scope.forEach((s) => names.add(s.studentName));
  return names.size;
}

function recentSubmissions(submissions, limit) {
  return submissions.slice().sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)).slice(0, limit);
}

function buildStudentProfiles(submissions) {
  const byStudent = new Map();
  submissions.forEach((s) => {
    if (!byStudent.has(s.studentName)) byStudent.set(s.studentName, []);
    byStudent.get(s.studentName).push(s);
  });

  const profiles = [];
  for (const [name, subs] of byStudent) {
    const evaluated = subs.filter(hasValidScore).slice().sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
    if (!evaluated.length) continue;
    const scores = evaluated.map((s) => s.finalScore);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const latest = scores.at(-1);
    const prev = evaluated.length > 1 ? scores.at(-2) : latest;
    const trend = latest - prev;
    const comps = aggregateCompetencies(evaluated);
    const weak = weakestCompetency(comps);
    const repeatedWeak = weak && weak.count >= 2 && weak.avg < ATTENTION_SCORE_THRESHOLD;

    const atRisk =
      avg < ATTENTION_SCORE_THRESHOLD ||
      trend <= ATTENTION_TREND_THRESHOLD ||
      repeatedWeak;

    profiles.push({
      studentName: name,
      latest,
      avg,
      trend: trend > 0 ? 1 : trend < 0 ? -1 : 0,
      mainIssue: repeatedWeak && weak ? `${weak.name} (berulang)` : weak ? weak.name : "—",
      atRisk,
    });
  }
  return profiles.sort((a, b) => (b.atRisk - a.atRisk) || (a.avg - b.avg));
}

function aggregateCompetencies(submissions) {
  const map = new Map();
  submissions.forEach((sub) => {
    (sub.criteria || []).forEach((c) => {
      if (!Number.isFinite(Number(c.score))) return;
      const name = c.name || prettifyId(c.criterionId) || "Kriteria";
      const entry = map.get(name) || { name, total: 0, count: 0 };
      entry.total += Number(c.score);
      entry.count += 1;
      map.set(name, entry);
    });
  });
  return [...map.values()]
    .map((e) => ({ name: e.name, avg: e.total / e.count, count: e.count }))
    .sort((a, b) => b.avg - a.avg);
}

function weakestCompetency(comps) {
  return comps.length ? comps[comps.length - 1] : null;
}

function criteriaAvgConfidence(criteria) {
  const confs = (criteria || [])
    .map((c) => Number(c.confidence))
    .filter((v) => Number.isFinite(v) && v > 0);
  if (!confs.length) return null;
  return confs.reduce((a, b) => a + b, 0) / confs.length;
}

function criteriaCoverage(criteria) {
  if (!criteria || !criteria.length) return null;
  const withEvidence = criteria.filter(
    (c) => Array.isArray(c.evidence) && c.evidence.some((ev) => ev && ev.grounded === true)
  ).length;
  return Math.round((withEvidence / criteria.length) * 100);
}

// ---- Assessment list tab filtering ---------------------------------------

function renderAssessmentsWithTab(ctx) {
  const { els, state } = ctx;
  const activeTab = els.assessmentTabFilter.querySelector(".tab-filter-btn.active")?.dataset.tab || "all";
  let list = state.assessments;
  if (activeTab === "draft") list = list.filter((a) => a.status === "draft");
  if (activeTab === "published") list = list.filter((a) => a.status !== "draft");

  els.assessmentCount.textContent = String(list.length);
  if (!list.length) {
    els.assessmentList.className = "list-stack empty-state";
    els.assessmentList.innerHTML = `<div class="empty-state"><span class="empty-state-icon" aria-hidden="true">○</span>
      <div><strong>${activeTab === "draft" ? "Belum ada draft" : "Belum ada penilaian"}</strong>
      <p>${activeTab === "draft" ? "Penilaian yang belum dipublish akan muncul di sini." : "Buat penilaian pertama untuk mulai."}</p></div></div>`;
    return;
  }
  els.assessmentList.className = "list-stack";
  els.assessmentList.innerHTML = list.map(renderAssessmentItem).join("");
}

// ---- Assorted UI helpers --------------------------------------------------

function kpiCard(label, value, sub, hint) {
  return `
    <div class="kpi-card">
      <span class="kpi-label">${escapeHtml(label)}</span>
      <strong class="kpi-value">${escapeHtml(value)}</strong>
      <span class="kpi-sub">${escapeHtml(sub)}</span>
      ${hint ? `<span class="kpi-hint" title="${escapeHtml(hint)}">ⓘ</span>` : ""}
    </div>
  `;
}

function renderSkeleton(el, count, height = 120) {
  if (!el) return;
  el.innerHTML = Array.from({ length: count }, () =>
    `<div class="skeleton" style="height:${height}px"></div>`
  ).join("");
}

function renderSkeletonLines(count) {
  return Array.from({ length: count }, () => `<div class="skeleton skeleton-line"></div>`).join("");
}

function populateClassFilter(ctx, select, currentValue) {
  if (!select) return;
  const current = currentValue || select.value;
  const options = ['<option value="">Semua Kelas</option>']
    .concat(ctx.state.classes.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`))
    .join("");
  if (select.innerHTML !== options || select.value !== current) {
    select.innerHTML = options;
    if (current && ctx.state.classes.some((c) => c.id === current)) select.value = current;
  }
}

function verificationBadge(status) {
  const cls =
    status === "FAIL" ? "verification-mini-badge-bad" :
    status === "REVIEW" ? "verification-mini-badge-warn" : "verification-mini-badge-ok";
  const label = status === "FAIL" ? "✕ Failed" : status === "REVIEW" ? "⚠ Perlu Review" : "✓ Verified";
  return `<span class="verification-mini ${cls}">${label}</span>`;
}

function buildProfileTrend(evaluated) {
  const W = 640;
  const H = 160;
  const padL = 34;
  const padR = 10;
  const padT = 14;
  const padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = Math.max(2, evaluated.length);
  const slot = innerW / (n - 1);
  const yFor = (v) => padT + innerH - (v / 100) * innerH;

  const pointsStr = evaluated
    .map((s, i) => `${(padL + slot * i).toFixed(1)},${yFor(s.finalScore).toFixed(1)}`)
    .join(" ");

  const gridLines = [0, 25, 50, 75, 100]
    .map((v) => `<line x1="${padL}" y1="${yFor(v)}" x2="${W - padR}" y2="${yFor(v)}" stroke="${cssVar("--border")}" stroke-width="1"/>`)
    .join("");
  const gridLabels = [0, 25, 50, 75, 100]
    .map((v) => `<text x="${padL - 6}" y="${yFor(v) + 4}" text-anchor="end" fill="${cssVar("--text-muted")}" font-size="10">${v}</text>`)
    .join("");
  const circles = evaluated
    .map((s, i) => `<circle cx="${(padL + slot * i).toFixed(1)}" cy="${yFor(s.finalScore).toFixed(1)}" r="4" fill="${cssVar("--brand")}"/>`)
    .join("");
  const xLabels = evaluated
    .map((s, i) => `<text x="${(padL + slot * i).toFixed(1)}" y="${H - 8}" text-anchor="middle" fill="${cssVar("--text-muted")}" font-size="9">${escapeXml(formatDate(s.submittedAt))}</text>`)
    .join("");

  return `
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik skor siswa dari waktu ke waktu">
      ${gridLines}
      ${gridLabels}
      <polyline points="${pointsStr}" fill="none" stroke="${cssVar("--success-strong")}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
      ${circles}
      ${xLabels}
    </svg>
  `;
}

function trendArrow(trend) {
  return trend > 0 ? "↑" : trend < 0 ? "↓" : "→";
}

function trendClass(trend) {
  return trend > 0 ? "trend-up" : trend < 0 ? "trend-down" : "trend-flat";
}

function prettifyId(id) {
  return String(id || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\d{2,3}\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRichText(text) {
  if (!text) return "";
  const escaped = escapeHtml(String(text));
  return escaped.split(/\r?\n/).map((l) => {
    if (l.trim().startsWith("- ")) return `<li>${escapeHtmlSup(l.trim().slice(2))}</li>`;
    if (l.trim().startsWith("* ")) return `<li>${escapeHtmlSup(l.trim().slice(2))}</li>`;
    return l ? `<p>${escapeHtmlSup(l)}</p>` : "";
  }).join("");
}

function escapeHtmlSup(text) {
  let t = String(text).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>");
  return t;
}

function escapeXml(text) {
  return String(text) .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// ---------------------------------------------------------------------------
// #6: Longitudinal Competency Trend Chart
// ---------------------------------------------------------------------------

/**
 * Render a longitudinal chart showing how each criterion score changes over
 * time (by submission date). Uses inline SVG.
 */
function renderCompTrend(ctx, evaluated) {
  const { els } = ctx;
  if (!els.compTrendChart) return;

  const sorted = evaluated.slice().sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
  if (sorted.length < 2) {
    els.compTrendChart.innerHTML = '<p class="empty-state">Butuh minimal 2 submission untuk melihat tren kompetensi.</p>';
    return;
  }

  // Aggregate criteria scores per submission
  const compMap = new Map(); // criterionName -> [{ date, score }]
  for (const sub of sorted) {
    const date = new Date(sub.submittedAt).toLocaleDateString("id-ID", { month: "short", day: "numeric" });
    (sub.criteria || []).forEach((c) => {
      if (!Number.isFinite(Number(c.score))) return;
      const name = c.name || prettifyId(c.criterionId) || "Kriteria";
      if (!compMap.has(name)) compMap.set(name, []);
      compMap.get(name).push({ date, score: Number(c.score) });
    });
  }

  if (compMap.size === 0) {
    els.compTrendChart.innerHTML = '<p class="empty-state">Belum ada data kriteria. Evaluasi perlu memakai rubrik.</p>';
    return;
  }

  const COLORS = ["--brand", "--success", "--info", "--danger", "--warning", "--ai", "--voice", "--success-strong"].map((t) => cssVar(t));
  const entries = [...compMap.entries()];
  const W = 600, H = 180, PAD = 30;
  const allDates = [...new Set(sorted.map((s) => new Date(s.submittedAt).toLocaleDateString("id-ID", { month: "short", day: "numeric" })))];

  // Build legend
  els.compTrendLegend.innerHTML = entries.map(([name], i) =>
    `<span><span class="swatch" style="background:${COLORS[i % COLORS.length]}"></span>${escapeHtml(name)}</span>`
  ).join("");

  // Build SVG
  let paths = "";
  entries.forEach(([name, points], i) => {
    const color = COLORS[i % COLORS.length];
    const xScale = (idx) => PAD + (idx / Math.max(1, allDates.length - 1)) * (W - 2 * PAD);
    const yScale = (score) => H - PAD - (score / 100) * (H - 2 * PAD);

    // Group by date (average if multiple submissions same date)
    const byDate = new Map();
    points.forEach((p) => {
      if (!byDate.has(p.date)) byDate.set(p.date, []);
      byDate.get(p.date).push(p.score);
    });
    const avgPoints = [...byDate.entries()].map(([date, scores]) => ({
      date,
      score: scores.reduce((a, b) => a + b, 0) / scores.length,
    }));

    const line = avgPoints.map((p, idx) => {
      const x = xScale(allDates.indexOf(p.date));
      const y = yScale(p.score);
      return `${idx === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

    paths += `<path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    paths += avgPoints.map((p, idx) => {
      const x = xScale(allDates.indexOf(p.date));
      const y = yScale(p.score);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${color}" stroke="white" stroke-width="1.5"/>`;
    }).join("");
  });

  // X-axis labels
  const xLabels = allDates.map((d, idx) => {
    const x = PAD + (idx / Math.max(1, allDates.length - 1)) * (W - 2 * PAD);
    return `<text x="${x.toFixed(1)}" y="${H - 5}" text-anchor="middle" font-size="9" fill="${cssVar("--text-muted")}">${d}</text>`;
  }).join("");

  // Y-axis labels
  const yLabels = [0, 25, 50, 75, 100].map((v) => {
    const y = H - PAD - (v / 100) * (H - 2 * PAD);
    return `<text x="${PAD - 5}" y="${y.toFixed(1) + 4}" text-anchor="end" font-size="9" fill="${cssVar("--text-muted")}">${v}</text>`;
  }).join("");

  els.compTrendChart.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:100%;" role="img" aria-label="Grafik tren kompetensi">
      <line x1="${PAD}" y1="${H - PAD}" x2="${W - PAD}" y2="${H - PAD}" stroke="${cssVar("--border")}" stroke-width="1"/>
      <line x1="${PAD}" y1="${PAD}" x2="${PAD}" y2="${H - PAD}" stroke="${cssVar("--border")}" stroke-width="1"/>
      ${[25, 50, 75].map((v) => {
        const y = H - PAD - (v / 100) * (H - 2 * PAD);
        return `<line x1="${PAD}" y1="${y}" x2="${W - PAD}" y2="${y}" stroke="${cssVar("--border")}" stroke-width="1"/>`;
      }).join("")}
      ${paths}
      ${xLabels}
      ${yLabels}
    </svg>
  `;
}

export { renderAssessmentsWithTab };