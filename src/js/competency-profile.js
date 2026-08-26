import { escapeHtml } from "./utils.js";

/**
 * Competency (rubrik) profile rendering for a class and a single student.
 *
 * Represents each rubrik criterion as a gradation table of levels (score/label/
 * descriptor) and shows:
 *   - student profile  : the achieved level per criterion (highlighted),
 *   - class overview   : the distribution of submissions across levels.
 *
 * This module is kept free of browser/global side effects so the aggregation
 * and scoring can be unit-tested in isolation.
 */

const DEFAULT_LEVELS = [
  { score: 4, label: "Sangat Baik", descriptor: "" },
  { score: 3, label: "Baik", descriptor: "" },
  { score: 2, label: "Cukup", descriptor: "" },
  { score: 1, label: "Kurang", descriptor: "" },
];

function normalize(v) {
  return String(v == null ? "" : v).trim().toLowerCase();
}

function prettify(id) {
  return String(id || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();
}

function fillDescriptors(name, levels) {
  const base = name || "Kriteria";
  const templates = [
    `${base} sangat baik, lengkap, dan tepat`,
    `${base} baik dan memadai`,
    `${base} cukup, namun masih perlu pengembangan`,
    `${base} kurang, perlu perbaikan signifikan`,
  ];
  return levels.map((l, i) => ({
    score: l.score,
    label: l.label || "",
    descriptor: l.descriptor || templates[i] || "",
  }));
}

function defaultCriteria() {
  return [
    { id: "c1", name: "", weight: 0, levels: fillDescriptors("", JSON.parse(JSON.stringify(DEFAULT_LEVELS))) },
  ];
}

/**
 * Parse a rubric (JSON v2 string or legacy "Nama 40%" text) into an array of
 * { id, name, weight, levels:[{score,label,descriptor}] }. Self-contained so
 * the module stays pure and testable.
 */
export function parseRubricToCriteria(text) {
  if (!text || !text.trim()) return defaultCriteria();
  const t = text.trim();
  if (t.startsWith("{")) {
    try {
      const p = JSON.parse(t);
      if (p.version === "2" && Array.isArray(p.criteria) && p.criteria.length) {
        return p.criteria.map((c, i) => ({
          id: c.id || `c${i + 1}`,
          name: c.name || "",
          weight: Number(c.weight) || 0,
          levels: Array.isArray(c.levels) && c.levels.length === 4
            ? fillDescriptors(c.name || "", c.levels.map((l) => ({ score: l.score, label: l.label, descriptor: l.descriptor })))
            : fillDescriptors(c.name || "", JSON.parse(JSON.stringify(DEFAULT_LEVELS))),
        }));
      }
    } catch { /* fall through */ }
  }
  const raw = t;
  const lines = [];
  let depth = 0, start = 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === "(" || raw[i] === "[" || raw[i] === "{") depth++;
    else if (raw[i] === ")" || raw[i] === "]" || raw[i] === "}") depth--;
    else if (depth === 0 && (raw[i] === "," || raw[i] === ";" || raw[i] === "\n")) {
      const seg = raw.slice(start, i).trim();
      if (seg) lines.push(seg);
      start = i + 1;
    }
  }
  const last = raw.slice(start).trim();
  if (last) lines.push(last);
  if (!lines.length) lines.push("");
  return lines.map((line, i) => {
    let name = line.trim().replace(/^[•\-*]\s*/, "").replace(/[.!]+$/, "").trim();
    let weight = 0;
    let m = name.match(/^(.+?)\s*[-:–]?\s*\(?\s*(\d+(?:\.\d+)?)\s*%?\s*\)?$/);
    if (m) { name = m[1].trim(); weight = Number(m[2]); }
    else { m = name.match(/^(\d+(?:\.\d+)?)\s*%?\s+(.+)$/); if (m) { weight = Number(m[1]); name = m[2].trim(); } }
    return { id: `c${i + 1}`, name, weight, levels: fillDescriptors(name, JSON.parse(JSON.stringify(DEFAULT_LEVELS))) };
  });
}

/**
 * Collect all criterion definitions (from the assessment rubric, falling back
 * to per-question rubrics) into two lookup maps keyed by id and normalized name.
 */
function collectRubric(assessments, assessmentId) {
  const byId = new Map();
  const byName = new Map();
  const push = (defs) => {
    (defs || []).forEach((d) => {
      if (!d || !d.name) return;
      if (!byId.has(String(d.id))) byId.set(String(d.id), d);
      if (!byName.has(normalize(d.name))) byName.set(normalize(d.name), d);
    });
  };
  const assessment = (assessments || []).find((a) => a && (a.id === assessmentId || a.assessment_id === assessmentId));
  if (assessment) {
    if (assessment.rubric) push(parseRubricToCriteria(assessment.rubric));
    (assessment.questions || []).forEach((q) => {
      if (q && q.rubric) push(parseRubricToCriteria(q.rubric));
    });
  }
  return { byId, byName };
}

/** Map a 0-100 score to the nearest rubric level (by its score), clamped. */
export function levelForScore(score, levels) {
  const list = Array.isArray(levels) && levels.length ? levels : DEFAULT_LEVELS;
  const max = Math.max(...list.map((l) => Number(l.score)));
  const target = (Number(score) / 100) * max;
  let best = list[0];
  let bestDiff = Infinity;
  for (const l of list) {
    const diff = Math.abs(Number(l.score) - target);
    if (diff < bestDiff) { bestDiff = diff; best = l; }
  }
  return best;
}

/** 0-100 score -> the rubric score (4,3,2,1) it maps to. */
function levelScore(score, levels) {
  const max = Math.max(...levels.map((l) => Number(l.score)));
  const n = Math.max(1, Math.min(max, Math.round((Number(score) / 100) * max)));
  return n;
}

/**
 * Build the competency profile across submissions.
 *
 * @param {object[]} assessments  assessments in state (payloads with rubric/questions)
 * @param {object[]} submissions  submissions each with { assessmentId, studentName, criteria:[{criterionId,name,score,weight}] }
 * @returns {object[]} criterion entries:
 *   { name, weight, levels, records:[{studentName,score}], avg, achieved, distribution:[{level,label,descriptor,count,pct}] }
 */
export function buildCompetencyProfile(assessments, submissions) {
  const map = new Map();
  (submissions || []).forEach((sub) => {
    const { byId, byName } = collectRubric(assessments, sub.assessmentId);
    (Array.isArray(sub.criteria) ? sub.criteria : []).forEach((c) => {
      if (!Number.isFinite(Number(c.score))) return;
      const def = byId.get(String(c.criterionId)) || byName.get(normalize(c.name));
      const name = (def && def.name) || c.name || prettify(c.criterionId) || "Kriteria";
      let entry = map.get(name);
      if (!entry) {
        entry = {
          name,
          weight: def ? Number(def.weight) || 0 : Number.isFinite(Number(c.weight)) ? Number(c.weight) * 100 : 0,
          levels: def && Array.isArray(def.levels) && def.levels.length ? def.levels : JSON.parse(JSON.stringify(DEFAULT_LEVELS)),
          records: [],
        };
        map.set(name, entry);
      }
      entry.records.push({ studentName: sub.studentName, score: Number(c.score) });
    });
  });

  const out = [];
  for (const entry of map.values()) {
    const levels = entry.levels;
    const total = entry.records.reduce((a, r) => a + r.score, 0);
    const avg = total / entry.records.length;
    const distribution = levels
      .map((l) => ({ level: l, count: entry.records.filter((r) => levelScore(r.score, levels) === Number(l.score)).length }))
      .sort((a, b) => b.level.score - a.level.score);
    const maxCount = Math.max(0, ...distribution.map((d) => d.count));
    distribution.forEach((d) => {
      d.pct = entry.records.length ? Math.round((d.count / entry.records.length) * 100) : 0;
      d.dominant = entry.records.length > 0 && d.count === maxCount && d.count > 0;
    });
    out.push({
      name: entry.name,
      weight: entry.weight,
      levels,
      records: entry.records,
      avg,
      achieved: levelForScore(avg, levels),
      distribution,
    });
  }
  return out.sort((a, b) => b.avg - a.avg);
}

const scoreClass = (n) => `sb-${Math.max(1, Math.min(4, Number(n)))}`;

/**
 * Student profile: compact list of competency titles with achieved level & score.
 * @param {object[]} comps result of buildCompetencyProfile
 */
export function renderCompetencyStudent(comps) {
  if (!comps || !comps.length) {
    return `<p class="empty-state">Belum ada data kriteria rubrik untuk ditampilkan.</p>`;
  }
  return `
    <div class="competency-simple">
      ${comps.map((c) => {
        const s = Number(c.achieved ? c.achieved.score : 0);
        return `
          <div class="competency-row">
            <div class="competency-info">
              <strong>${escapeHtml(c.name)}</strong>
              <span class="rubrik-muted">${c.records.length} penilaian${c.weight ? ` · bobot ${c.weight}%` : ""}</span>
            </div>
            <div class="rubrik-skor">
              <span class="rubrik-score-badge ${scoreClass(s)}">${Math.round(c.avg)}</span>
              <span class="rubrik-muted">/100</span>
            </div>
          </div>`;
      }).join("")}
    </div>
  `;
}

/**
 * Class overview: compact list of competency titles with average score.
 * @param {object[]} comps result of buildCompetencyProfile
 */
export function renderCompetencyClass(comps) {
  if (!comps || !comps.length) {
    return `<p class="empty-state">Belum ada data kompetensi. Evaluasi perlu memakai rubrik dengan kriteria (AI Harness).</p>`;
  }
  return `
    <div class="competency-simple">
      ${comps.map((c) => `
        <div class="competency-row">
          <div class="competency-info">
            <strong>${escapeHtml(c.name)}</strong>
            <span class="rubrik-muted">${c.records.length} pengumpulan${c.weight ? ` · bobot ${c.weight}%` : ""}</span>
          </div>
          <div class="rubrik-skor">
            <span class="rubrik-score-badge ${scoreClass(c.achieved.score)}">${Math.round(c.avg)}</span>
            <span class="rubrik-muted">/100</span>
          </div>
        </div>`).join("")}
    </div>
  `;
}