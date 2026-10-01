import { escapeHtml } from "./utils.js";

function levelLabel(level) {
  return ({ MASTERED: "Sudah kuat", DEVELOPING: "Sedang berkembang", NEEDS_SUPPORT: "Perlu latihan", INSUFFICIENT_EVIDENCE: "Belum cukup evidence" })[level] || "Belum ada data";
}
function levelClass(level) { return String(level || "insufficient").toLowerCase().replace(/_/g, "-"); }
function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
function trendLabel(trend) {
  if (trend?.direction === "IMPROVING") return "Naik " + Math.round(trend.delta) + " poin";
  if (trend?.direction === "DECLINING") return "Turun " + Math.abs(Math.round(trend.delta)) + " poin";
  if (trend?.direction === "STABLE") return "Relatif stabil";
  return "Baseline";
}
async function loadTrajectory() {
  const response = await fetch("/api/competency-trajectory", { credentials: "include" });
  if (!response.ok) throw new Error("trajectory unavailable");
  const data = await response.json();
  return Array.isArray(data.trajectory) ? data.trajectory : [];
}
function renderSummary(el, trajectories) {
  const scored = trajectories.filter((item) => Number.isFinite(Number(item.latest?.score)));
  const average = scored.length ? Math.round(scored.reduce((sum, item) => sum + Number(item.latest.score), 0) / scored.length) : null;
  const improving = trajectories.filter((item) => item.trend?.direction === "IMPROVING").length;
  const needSupport = trajectories.filter((item) => ["NEEDS_SUPPORT", "INSUFFICIENT_EVIDENCE"].includes(item.latest?.level)).length;
  el.innerHTML = [["Kompetensi terukur", trajectories.length, "Learning Outcome dengan data"], ["Rata-rata terkini", average == null ? "—" : average, "dari skor terbaru tiap kompetensi"], ["Meningkat", improving, "kompetensi dengan tren positif"], ["Perlu perhatian", needSupport, "kompetensi yang masih perlu latihan/evidence"]].map(function(item) {
    return '<div class="kpi-card"><span class="kpi-label">' + escapeHtml(item[0]) + '</span><strong class="kpi-value">' + escapeHtml(item[1]) + '</strong><span class="kpi-sub">' + escapeHtml(item[2]) + '</span></div>';
  }).join("");
}
function renderTrajectoryCards(el, trajectories) {
  if (!trajectories.length) {
    el.innerHTML = '<div class="empty-state">Belum ada hasil assessment yang terhubung ke Learning Outcome. Setelah kamu menyelesaikan assessment, perkembangan kompetensimu akan muncul di sini.</div>';
    return;
  }
  el.innerHTML = trajectories.map(function(item) {
    const latest = item.latest || {};
    const score = latest.score == null ? "—" : Math.round(latest.score);
    const coverage = latest.evidenceCoverage == null ? "—" : Math.round(latest.evidenceCoverage * 100) + "%";
    const points = (item.history || []).slice(-6).map(function(point) {
      return '<div class="student-competency-point"><span>' + escapeHtml(formatDate(point.submittedAt)) + '</span><strong>' + (point.score == null ? "—" : Math.round(point.score)) + '</strong></div>';
    }).join("");
    return '<article class="student-competency-card"><div class="student-competency-card-head"><div><span class="student-competency-id">' + escapeHtml(item.learningOutcomeId || "") + '</span><h4>' + escapeHtml(item.learningOutcome || "Learning Outcome") + '</h4></div><span class="competency-level competency-level-' + levelClass(latest.level) + '">' + escapeHtml(levelLabel(latest.level)) + '</span></div><div class="student-competency-score-row"><div><strong>' + score + '</strong><span>/100</span></div><div class="student-competency-trend">' + escapeHtml(trendLabel(item.trend)) + '</div></div><div class="student-competency-progress"><span style="width:' + Math.max(0, Math.min(100, Number(latest.score) || 0)) + '%"></span></div><div class="student-competency-meta"><span>Evidence coverage: <strong>' + coverage + '</strong></span><span>' + (item.snapshotCount || 0) + ' assessment</span></div><div class="student-competency-history" aria-label="Riwayat enam assessment terakhir">' + (points || '<span class="panel-hint">Belum ada riwayat skor.</span>') + '</div></article>';
  }).join("");
}
export async function renderStudentCompetency(ctx) {
  const { els } = ctx;
  if (!els.studentCompetencyList) return;
  els.studentCompetencyList.innerHTML = '<div class="skeleton" style="height:180px"></div>';
  try {
    const trajectories = await loadTrajectory();
    if (els.studentCompetencyCount) els.studentCompetencyCount.textContent = trajectories.length + " kompetensi";
    renderSummary(els.studentCompetencySummary, trajectories);
    renderTrajectoryCards(els.studentCompetencyList, trajectories);
  } catch (error) {
    if (els.studentCompetencySummary) els.studentCompetencySummary.innerHTML = "";
    els.studentCompetencyList.innerHTML = '<div class="empty-state">Perkembangan kompetensi belum dapat dimuat. Coba lagi nanti.</div>';
  }
}