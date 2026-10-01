import { escapeHtml } from "./utils.js";

let state = { trajectories: [], query: "", status: "ALL", sort: "score" };

function levelLabel(level) {
  return ({ MASTERED: "Sudah kuat", DEVELOPING: "Sedang berkembang", NEEDS_SUPPORT: "Perlu latihan", INSUFFICIENT_EVIDENCE: "Belum cukup evidence" })[level] || "Belum ada data";
}
function levelClass(level) { return String(level || "insufficient").toLowerCase().replace(/_/g, "-"); }
function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}
function trendLabel(trend) {
  if (trend?.direction === "IMPROVING") return "Naik " + Math.round(trend.delta) + " poin";
  if (trend?.direction === "DECLINING") return "Turun " + Math.abs(Math.round(trend.delta)) + " poin";
  if (trend?.direction === "STABLE") return "Relatif stabil";
  return "Baseline";
}
function trendClass(trend) {
  if (trend?.direction === "IMPROVING") return "is-up";
  if (trend?.direction === "DECLINING") return "is-down";
  return "is-flat";
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
  el.innerHTML = [
    ["Kompetensi terukur", trajectories.length, "Learning Outcome dengan data", "neutral"],
    ["Rata-rata terkini", average == null ? "—" : average, "Skor terbaru tiap kompetensi", "primary"],
    ["Meningkat", improving, "Kompetensi dengan tren positif", "positive"],
    ["Perlu perhatian", needSupport, "Masih perlu latihan atau evidence", "attention"],
  ].map((item) => '<div class="student-kpi-card student-kpi-' + item[3] + '"><span class="kpi-label">' + escapeHtml(item[0]) + '</span><strong class="kpi-value">' + escapeHtml(item[1]) + '</strong><span class="kpi-sub">' + escapeHtml(item[2]) + '</span></div>').join("");
}
function filteredTrajectories() {
  const q = state.query.trim().toLowerCase();
  const filtered = state.trajectories.filter((item) => {
    const matchesQuery = !q || String(item.learningOutcome || "").toLowerCase().includes(q) || String(item.learningOutcomeId || "").toLowerCase().includes(q);
    const level = item.latest?.level;
    const matchesStatus = state.status === "ALL"
      || (state.status === "STRONG" && level === "MASTERED")
      || (state.status === "DEVELOPING" && level === "DEVELOPING")
      || (state.status === "ATTENTION" && ["NEEDS_SUPPORT", "INSUFFICIENT_EVIDENCE"].includes(level));
    return matchesQuery && matchesStatus;
  });
  return filtered.sort((a, b) => {
    if (state.sort === "name") return String(a.learningOutcome || "").localeCompare(String(b.learningOutcome || ""), "id");
    if (state.sort === "trend") return Number(b.trend?.delta || 0) - Number(a.trend?.delta || 0);
    return Number(b.latest?.score ?? -1) - Number(a.latest?.score ?? -1);
  });
}
function renderTrajectoryCards(el, trajectories) {
  if (!trajectories.length) {
    el.innerHTML = '<div class="student-competency-empty"><strong>Tidak ada kompetensi yang cocok.</strong><span>Coba ubah pencarian atau filter.</span></div>';
    return;
  }
  el.innerHTML = trajectories.map((item) => {
    const latest = item.latest || {};
    const score = latest.score == null ? "—" : Math.round(latest.score);
    const coverage = latest.evidenceCoverage == null ? "—" : Math.round(latest.evidenceCoverage * 100) + "%";
    const history = (item.history || []).slice(-6);
    const max = Math.max(...history.map((p) => Number(p.score) || 0), 100);
    const points = history.map((point) => {
      const value = point.score == null ? 0 : Math.max(4, Math.min(100, Number(point.score)));
      return '<div class="student-competency-bar" title="' + escapeHtml(formatDate(point.submittedAt) + " · " + Math.round(Number(point.score) || 0)) + '"><span style="height:' + Math.round((value / max) * 100) + '%"></span></div>';
    }).join("");
    return '<article class="student-competency-card">' +
      '<div class="student-competency-card-head"><div class="student-competency-title"><span class="student-competency-id">' + escapeHtml(item.learningOutcomeId || "LO") + '</span><h4>' + escapeHtml(item.learningOutcome || "Learning Outcome") + '</h4></div><span class="competency-level competency-level-' + levelClass(latest.level) + '">' + escapeHtml(levelLabel(latest.level)) + '</span></div>' +
      '<div class="student-competency-score-row"><div class="student-score"><strong>' + score + '</strong><span>/100</span></div><div class="student-competency-trend ' + trendClass(item.trend) + '">' + escapeHtml(trendLabel(item.trend)) + '</div></div>' +
      '<div class="student-competency-progress"><span style="width:' + Math.max(0, Math.min(100, Number(latest.score) || 0)) + '%"></span></div>' +
      '<div class="student-competency-meta"><span>Evidence <strong>' + coverage + '</strong></span><span>' + (item.snapshotCount || 0) + ' assessment</span></div>' +
      '<div class="student-competency-history"><div class="student-history-label"><span>Perjalanan terakhir</span><span>' + (history.length ? formatDate(history[0].submittedAt) + " — " + formatDate(history[history.length - 1].submittedAt) : "Belum ada") + '</span></div><div class="student-competency-bars">' + (points || '<span class="panel-hint">Belum ada riwayat skor.</span>') + '</div></div>' +
      '</article>';
  }).join("");
}
function renderControls(ctx) {
  const { els } = ctx;
  if (!els.studentCompetencyControls) return;
  els.studentCompetencyControls.innerHTML =
    '<div class="student-competency-search"><span aria-hidden="true">⌕</span><input id="studentCompetencySearch" type="search" placeholder="Cari kompetensi..." value="' + escapeHtml(state.query) + '" aria-label="Cari kompetensi" /></div>' +
    '<div class="student-competency-filters" role="group" aria-label="Filter kompetensi">' +
      '<button type="button" class="student-filter-btn active" data-status="ALL">Semua</button>' +
      '<button type="button" class="student-filter-btn" data-status="STRONG">Sudah kuat</button>' +
      '<button type="button" class="student-filter-btn" data-status="DEVELOPING">Berkembang</button>' +
      '<button type="button" class="student-filter-btn" data-status="ATTENTION">Perlu perhatian</button>' +
    '</div>' +
    '<label class="student-sort"><span>Urutkan</span><select id="studentCompetencySort"><option value="score">Skor terbaru</option><option value="trend">Perubahan terbaru</option><option value="name">Nama kompetensi</option></select></label>';
  const input = els.studentCompetencyControls.querySelector("#studentCompetencySearch");
  const sort = els.studentCompetencyControls.querySelector("#studentCompetencySort");
  input.addEventListener("input", (event) => { state.query = event.target.value; renderTrajectoryCards(els.studentCompetencyList, filteredTrajectories()); });
  sort.value = state.sort;
  sort.addEventListener("change", (event) => { state.sort = event.target.value; renderTrajectoryCards(els.studentCompetencyList, filteredTrajectories()); });
  els.studentCompetencyControls.querySelectorAll("[data-status]").forEach((button) => {
    button.classList.toggle("active", button.dataset.status === state.status);
    button.addEventListener("click", () => {
      state.status = button.dataset.status;
      els.studentCompetencyControls.querySelectorAll("[data-status]").forEach((b) => b.classList.toggle("active", b.dataset.status === state.status));
      renderTrajectoryCards(els.studentCompetencyList, filteredTrajectories());
    });
  });
}
export async function renderStudentCompetency(ctx) {
  const { els } = ctx;
  if (!els.studentCompetencyList) return;
  els.studentCompetencyList.innerHTML = '<div class="skeleton" style="height:180px"></div>';
  try {
    state.trajectories = await loadTrajectory();
    state.query = "";
    state.status = "ALL";
    if (els.studentCompetencyCount) els.studentCompetencyCount.textContent = state.trajectories.length + " kompetensi";
    renderSummary(els.studentCompetencySummary, state.trajectories);
    renderControls(ctx);
    renderTrajectoryCards(els.studentCompetencyList, filteredTrajectories());
  } catch (error) {
    if (els.studentCompetencySummary) els.studentCompetencySummary.innerHTML = "";
    if (els.studentCompetencyControls) els.studentCompetencyControls.innerHTML = "";
    els.studentCompetencyList.innerHTML = '<div class="student-competency-empty"><strong>Perkembangan kompetensi belum dapat dimuat.</strong><span>Coba lagi nanti.</span></div>';
  }
}
