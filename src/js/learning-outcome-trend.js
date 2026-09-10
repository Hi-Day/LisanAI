const TREND_COLORS = ["--brand", "--success", "--info", "--danger", "--warning", "--ai", "--voice", "--success-strong"];

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function parseOutcomes(assessment) {
  const raw = assessment?.outcomes ?? assessment?.learningOutcomes ?? assessment?.learningOutcome ?? [];
  const values = Array.isArray(raw) ? raw : String(raw || "").split(/[\n;]+/);
  return values.map((item, index) => {
    if (item && typeof item === "object") {
      const id = item.id || item.learningOutcomeId || item.outcomeId || `LO${index + 1}`;
      const name = item.name || item.title || item.description || id;
      return { id: String(id), name: String(name) };
    }
    const text = String(item || "").trim();
    if (!text) return null;
    const match = text.match(/^([A-Za-z]+\d+[A-Za-z0-9_-]*)\s*[:.-]\s*(.+)$/);
    return match ? { id: match[1], name: match[2].trim() } : { id: `LO${index + 1}`, name: text };
  }).filter(Boolean);
}

function matches(candidate, outcome) {
  if (!candidate || !outcome) return false;
  const c = normalize(candidate);
  const id = normalize(outcome.id);
  const name = normalize(outcome.name);
  return c === id || c === name || c.includes(id) || name.includes(c);
}

function resolveQuestionOutcome(question, outcomes) {
  if (!question || !outcomes.length) return null;
  const explicit = question.learningOutcomeId ?? question.outcomeId ?? question.learningOutcome ?? question.outcome;
  if (explicit != null) return outcomes.find((outcome) => matches(explicit, outcome)) || null;
  return outcomes.length === 1 ? outcomes[0] : null;
}

function buildAssessmentMaps(assessments) {
  const maps = new Map();
  (Array.isArray(assessments) ? assessments : []).forEach((assessment) => {
    const outcomes = parseOutcomes(assessment);
    const questions = Array.isArray(assessment.questions) ? assessment.questions : [];
    maps.set(assessment.id, {
      outcomes,
      questionOutcomes: questions.map((question) => resolveQuestionOutcome(question, outcomes)),
    });
  });
  return maps;
}

function renderTrend(container, legend, state) {
  const submissions = (state.submissions || [])
    .filter((submission) => Number.isFinite(Number(submission.finalScore)))
    .slice()
    .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));

  if (submissions.length < 2) {
    container.innerHTML = '<p class="empty-state">Butuh minimal 2 submission untuk melihat tren capaian Learning Outcome.</p>';
    if (legend) legend.innerHTML = "";
    return;
  }

  const maps = buildAssessmentMaps(state.assessments);
  const data = new Map();

  for (const submission of submissions) {
    const map = maps.get(submission.assessmentId);
    if (!map?.outcomes?.length) continue;
    const date = new Date(submission.submittedAt);
    const dateKey = date.toISOString().slice(0, 10);
    const dateLabel = date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    const buckets = new Map();

    (submission.criteria || []).forEach((criterion) => {
      const score = Number(criterion.score);
      if (!Number.isFinite(score)) return;

      let outcome = null;
      const direct = criterion.learningOutcomeId ?? criterion.outcomeId ?? criterion.learningOutcome ?? criterion.outcome;
      if (direct != null) outcome = map.outcomes.find((candidate) => matches(direct, candidate)) || null;

      const answerIndex = Number.isInteger(Number(criterion.answerIndex)) ? Number(criterion.answerIndex) : null;
      if (!outcome && answerIndex != null) outcome = map.questionOutcomes[answerIndex] || null;

      const questionIndex = Number(criterion.questionIndex);
      if (!outcome && Number.isInteger(questionIndex)) outcome = map.questionOutcomes[questionIndex] || null;
      if (!outcome && map.outcomes.length === 1) outcome = map.outcomes[0];
      if (!outcome) return;

      const key = `${normalize(outcome.id)}|${normalize(outcome.name)}`;
      const rawWeight = Number(criterion.weight);
      const weight = Number.isFinite(rawWeight) && rawWeight > 0 ? rawWeight : 1;
      const bucket = buckets.get(key) || { outcome, weighted: 0, weight: 0 };
      bucket.weighted += score * weight;
      bucket.weight += weight;
      buckets.set(key, bucket);
    });

    buckets.forEach(({ outcome, weighted, weight }) => {
      const key = `${normalize(outcome.id)}|${normalize(outcome.name)}`;
      if (!data.has(key)) data.set(key, { outcome, points: new Map() });
      data.get(key).points.set(dateKey, { dateKey, dateLabel, score: weighted / weight });
    });
  }

  const entries = [...data.values()];
  if (!entries.length) {
    container.innerHTML = '<p class="empty-state">Belum ada data Learning Outcome yang dapat ditelusuri dari question → criterion.</p>';
    if (legend) legend.innerHTML = "";
    return;
  }

  const allDates = [...new Set(submissions.map((submission) => new Date(submission.submittedAt).toISOString().slice(0, 10)))];
  const W = 640;
  const H = 210;
  const PAD_L = 40;
  const PAD_R = 16;
  const PAD_T = 18;
  const PAD_B = 32;
  const x = (index) => PAD_L + (index / Math.max(1, allDates.length - 1)) * (W - PAD_L - PAD_R);
  const y = (score) => H - PAD_B - (Math.max(0, Math.min(100, score)) / 100) * (H - PAD_T - PAD_B);
  const colors = TREND_COLORS.map(cssVar);

  if (legend) {
    legend.innerHTML = entries.map((entry, index) => {
      const points = [...entry.points.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
      const delta = points.length > 1 ? points.at(-1).score - points[0].score : null;
      const deltaText = delta == null ? "" : ` (${delta >= 0 ? "+" : ""}${Math.round(delta)} pt)`;
      return `<span><span class="swatch" style="background:${colors[index % colors.length]}"></span>${escapeHtml(entry.outcome.name)}${escapeHtml(deltaText)}</span>`;
    }).join("");
  }

  const grid = [0, 25, 50, 75, 100].map((value) => {
    const yy = y(value);
    return `<line x1="${PAD_L}" y1="${yy}" x2="${W - PAD_R}" y2="${yy}" stroke="${cssVar("--border")}" stroke-width="1"/><text x="${PAD_L - 7}" y="${yy + 4}" text-anchor="end" font-size="9" fill="${cssVar("--text-muted")}">${value}</text>`;
  }).join("");

  const paths = entries.map((entry, index) => {
    const color = colors[index % colors.length];
    const points = [...entry.points.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    const line = points.map((point, pointIndex) => `${pointIndex ? "L" : "M"}${x(allDates.indexOf(point.dateKey)).toFixed(1)},${y(point.score).toFixed(1)}`).join(" ");
    const dots = points.map((point) => `<circle cx="${x(allDates.indexOf(point.dateKey)).toFixed(1)}" cy="${y(point.score).toFixed(1)}" r="3.5" fill="${color}" stroke="white" stroke-width="1.5"><title>${escapeHtml(entry.outcome.name)} — ${escapeHtml(point.dateLabel)}: ${Math.round(point.score)}</title></circle>`).join("");
    return `<path d="${line}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
  }).join("");

  const labels = allDates.map((date, index) => {
    const label = new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    return `<text x="${x(index)}" y="${H - 7}" text-anchor="middle" font-size="9" fill="${cssVar("--text-muted")}">${escapeHtml(label)}</text>`;
  }).join("");

  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:100%;" role="img" aria-label="Grafik perkembangan Learning Outcome dari waktu ke waktu">${grid}${paths}${labels}</svg>`;
}

async function loadState() {
  const response = await fetch("/api/database?action=state", { credentials: "include" });
  if (!response.ok) throw new Error("state unavailable");
  return response.json();
}

async function refresh() {
  const container = document.getElementById("compTrendChart");
  const legend = document.getElementById("compTrendLegend");
  if (!container) return;
  try {
    const state = await loadState();
    renderTrend(container, legend, state);
  } catch {
    // The main dashboard remains authoritative if the user is not authenticated yet.
  }
}

function start() {
  const container = document.getElementById("compTrendChart");
  if (!container) return;

  const description = container.previousElementSibling;
  if (description?.classList.contains("panel-hint")) {
    description.textContent = "Perkembangan capaian Learning Outcome dari waktu ke waktu. Criterion tetap menjadi evidence yang membentuk skor setiap outcome.";
  }

  const observer = new MutationObserver(() => {
    clearTimeout(start.timer);
    start.timer = setTimeout(refresh, 80);
  });
  observer.observe(container, { childList: true, subtree: true });
  refresh();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
