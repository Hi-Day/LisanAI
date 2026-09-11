const TREND_COLORS = ["--brand", "--success", "--info", "--danger", "--warning", "--ai", "--voice", "--success-strong"];

function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function escapeHtml(value) { const div = document.createElement("div"); div.textContent = String(value ?? ""); return div.innerHTML; }

function renderTrajectory(container, legend, trajectories) {
  const entries = (Array.isArray(trajectories) ? trajectories : []).filter((item) => item?.history?.length);
  const colors = TREND_COLORS.map(cssVar);
  if (!entries.length) {
    container.innerHTML = '<p class="empty-state">Belum cukup data untuk melihat trajectory Learning Outcome.</p>';
    if (legend) legend.innerHTML = "";
    return;
  }
  const allDates = [...new Set(entries.flatMap((entry) => entry.history.map((point) => point.submittedAt).filter(Boolean)))].sort();
  if (allDates.length < 2) {
    container.innerHTML = '<p class="empty-state">Butuh minimal 2 assessment untuk menentukan arah trajectory.</p>';
    if (legend) legend.innerHTML = entries.map((entry, index) => `<span><span class="swatch" style="background:${colors[index % colors.length]}"></span>${escapeHtml(entry.learningOutcome)}</span>`).join("");
    return;
  }

  const W = 640, H = 230, PAD_L = 40, PAD_R = 16, PAD_T = 18, PAD_B = 42;
  const x = (date) => PAD_L + (allDates.indexOf(date) / Math.max(1, allDates.length - 1)) * (W - PAD_L - PAD_R);
  const y = (score) => H - PAD_B - (Math.max(0, Math.min(100, Number(score) || 0)) / 100) * (H - PAD_T - PAD_B);
  if (legend) {
    legend.innerHTML = entries.map((entry, index) => {
      const delta = Number.isFinite(Number(entry.trend?.delta)) ? ` (${entry.trend.delta >= 0 ? "+" : ""}${Math.round(entry.trend.delta)} pt)` : "";
      return `<span><span class="swatch" style="background:${colors[index % colors.length]}"></span>${escapeHtml(entry.learningOutcome)}${escapeHtml(delta)}</span>`;
    }).join("");
  }
  const grid = [0, 25, 50, 75, 100].map((value) => {
    const yy = y(value);
    return `<line x1="${PAD_L}" y1="${yy}" x2="${W - PAD_R}" y2="${yy}" stroke="${cssVar("--border")}" stroke-width="1"/><text x="${PAD_L - 7}" y="${yy + 4}" text-anchor="end" font-size="9" fill="${cssVar("--text-muted")}">${value}</text>`;
  }).join("");
  const paths = entries.map((entry, index) => {
    const color = colors[index % colors.length];
    const points = entry.history.filter((point) => point.submittedAt && Number.isFinite(Number(point.score))).slice().sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
    const line = points.map((point, pointIndex) => `${pointIndex ? "L" : "M"}${x(point.submittedAt).toFixed(1)},${y(point.score).toFixed(1)}`).join(" ");
    const dots = points.map((point) => {
      const label = new Date(point.submittedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
      return `<circle cx="${x(point.submittedAt).toFixed(1)}" cy="${y(point.score).toFixed(1)}" r="3.5" fill="${color}" stroke="white" stroke-width="1.5"><title>${escapeHtml(entry.learningOutcome)} — ${escapeHtml(label)}: ${Math.round(point.score)}; evidence ${(Number(point.evidenceCoverage || 0) * 100).toFixed(0)}%</title></circle>`;
    }).join("");
    return `<path d="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
  }).join("");
  const labels = allDates.map((date) => `<text x="${x(date)}" y="${H - 12}" text-anchor="middle" font-size="9" fill="${cssVar("--text-muted")}">${escapeHtml(new Date(date).toLocaleDateString("id-ID", { day: "numeric", month: "short" }))}</text>`).join("");
  const summary = entries.map((entry) => {
    const latest = entry.latest || {};
    return `<span class="panel-hint">${escapeHtml(entry.learningOutcome)}: <strong>${latest.score == null ? "—" : Math.round(latest.score)}</strong> · ${escapeHtml(latest.level || "INSUFFICIENT_EVIDENCE")}</span>`;
  }).join("<br>");
  container.innerHTML = `<div style="margin-bottom:8px;display:grid;gap:2px;">${summary}</div><svg viewBox="0 0 ${W} ${H}" style="width:100%;height:100%;" role="img" aria-label="Grafik trajectory Learning Outcome dari waktu ke waktu">${grid}${paths}${labels}</svg>`;
}

async function loadTrajectory() {
  const response = await fetch("/api/competency-trajectory", { credentials: "include" });
  if (!response.ok) throw new Error("trajectory unavailable");
  const data = await response.json();
  return data.trajectory || [];
}

async function refresh() {
  const container = document.getElementById("compTrendChart");
  const legend = document.getElementById("compTrendLegend");
  if (!container) return;
  try { renderTrajectory(container, legend, await loadTrajectory()); }
  catch { container.innerHTML = '<p class="empty-state">Trajectory belum dapat dimuat. Data assessment tetap tersimpan.</p>'; }
}

function start() {
  const container = document.getElementById("compTrendChart");
  if (!container) return;
  const description = container.previousElementSibling;
  if (description?.classList.contains("panel-hint")) description.textContent = "Learning Outcome adalah unit trajectory; evidence dan criterion menjadi dasar pembentuk skor.";
  const observer = new MutationObserver(() => { clearTimeout(start.timer); start.timer = setTimeout(refresh, 80); });
  observer.observe(container, { childList: true, subtree: true });
  refresh();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
