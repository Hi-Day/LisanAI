import { escapeHtml, prettifyId } from "./utils.js";

/**
 * Competency profile is intentionally Learning-Outcome-first.
 *
 * Pedagogical hierarchy:
 *   Learning Outcome = class competency / intended construct
 *   Criterion       = observable evidence dimension
 *   Question        = instrument that elicits the evidence
 *
 * Criteria are shown only as supporting evidence beneath an LO; they are not
 * rendered as the class competency itself.
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

function normalizeOutcome(v) {
  return normalize(v).replace(/[^a-z0-9\u00C0-\u024F]+/gi, " ").replace(/\s+/g, " ").trim();
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
  return [{ id: "c1", name: "", weight: 0, levels: fillDescriptors("", JSON.parse(JSON.stringify(DEFAULT_LEVELS))) }];
}

export function parseRubricToCriteria(text) {
  if (!text || !String(text).trim()) return defaultCriteria();
  const t = String(text).trim();
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
    } catch { /* legacy text parser below */ }
  }
  const raw = t;
  const lines = [];
  let depth = 0;
  let start = 0;
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
    else {
      m = name.match(/^(\d+(?:\.\d+)?)\s*%?\s+(.+)$/);
      if (m) { weight = Number(m[1]); name = m[2].trim(); }
    }
    return { id: `c${i + 1}`, name, weight, levels: fillDescriptors(name, JSON.parse(JSON.stringify(DEFAULT_LEVELS))) };
  });
}

/** Parse class/assessment learning outcomes into stable display IDs. */
export function parseLearningOutcomes(value) {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (typeof item === "string") return { id: `LO${index + 1}`, text: item.trim() };
      return {
        id: String(item?.id || item?.learningOutcomeId || `LO${index + 1}`).trim(),
        text: String(item?.text || item?.name || item?.title || item?.outcome || "").trim(),
      };
    }).filter((x) => x.text);
  }
  const text = String(value || "").trim();
  if (!text) return [];
  return text.split(/\r?\n|\s*;\s*/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const named = line.match(/^(?:[-*•]\s*)?(?:LO|CPL|CPMK|Learning Outcome)\s*[-#:.)]?\s*(\d+)\s*[-:.):]?\s*(.+)$/i);
    if (named) return { id: `LO${named[1]}`, text: named[2].trim() };
    const numbered = line.match(/^(?:[-*•]\s*)?(\d+)[.)]\s*(.+)$/);
    if (numbered) return { id: `LO${numbered[1]}`, text: numbered[2].trim() };
    return { id: `LO${index + 1}`, text: line };
  });
}

function resolveQuestionOutcome(question, outcomes) {
  const explicitId = String(question?.learningOutcomeId || question?.outcomeId || "").trim();
  if (explicitId) {
    const byId = outcomes.find((lo) => normalize(lo.id) === normalize(explicitId));
    if (byId) return byId;
  }
  const text = normalizeOutcome(question?.outcome || "");
  if (text) {
    const exact = outcomes.find((lo) => normalizeOutcome(lo.text) === text);
    if (exact) return exact;
    const contains = outcomes.find((lo) => {
      const a = normalizeOutcome(lo.text);
      return a && (a.includes(text) || text.includes(a));
    });
    if (contains) return contains;
  }
  return null;
}

function collectRubric(assessments, assessmentId) {
  const byId = new Map();
  const byName = new Map();
  const push = (defs) => (defs || []).forEach((d) => {
    if (!d || !d.name) return;
    if (!byId.has(String(d.id))) byId.set(String(d.id), d);
    if (!byName.has(normalize(d.name))) byName.set(normalize(d.name), d);
  });
  const assessment = (assessments || []).find((a) => a && (a.id === assessmentId || a.assessment_id === assessmentId));
  if (assessment) {
    if (assessment.rubric) push(parseRubricToCriteria(assessment.rubric));
    (assessment.questions || []).forEach((q) => { if (q?.rubric) push(parseRubricToCriteria(q.rubric)); });
  }
  return { byId, byName, assessment };
}

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

function levelScore(score, levels) {
  const max = Math.max(...levels.map((l) => Number(l.score)));
  return Math.max(1, Math.min(max, Math.round((Number(score) / 100) * max)));
}

/**
 * Build LO-first competency profiles from evaluated submissions.
 * Criterion scores are traced through answerIndex -> question -> LO whenever
 * possible. A criterion without an LO path is intentionally excluded rather
 * than silently becoming a fake competency.
 */
export function buildCompetencyProfile(assessments, submissions) {
  const loMap = new Map();

  const ensureLO = (lo, assessment) => {
    const key = lo.id;
    if (!loMap.has(key)) {
      loMap.set(key, {
        id: lo.id,
        name: lo.text,
        weight: 0,
        levels: JSON.parse(JSON.stringify(DEFAULT_LEVELS)),
        records: [],
        criteriaMap: new Map(),
        assessmentIds: new Set(),
      });
    }
    const entry = loMap.get(key);
    if (assessment?.id) entry.assessmentIds.add(assessment.id);
    return entry;
  };

  (submissions || []).forEach((sub) => {
    const { byId, byName, assessment } = collectRubric(assessments, sub.assessmentId);
    const outcomes = parseLearningOutcomes(assessment?.outcomes);
    if (!assessment || !outcomes.length) return;
    const questions = Array.isArray(assessment.questions) ? assessment.questions : [];

    const questionLO = new Map();
    questions.forEach((q, index) => {
      const lo = resolveQuestionOutcome(q, outcomes);
      if (lo) questionLO.set(index, lo);
    });

    const studentBuckets = new Map();
    (Array.isArray(sub.criteria) ? sub.criteria : []).forEach((c) => {
      if (!Number.isFinite(Number(c.score))) return;
      const def = byId.get(String(c.criterionId)) || byName.get(normalize(c.name));
      const criterionId = String(c.criterionId || def?.id || c.name || "").trim();
      let lo = Number.isInteger(c.answerIndex) ? questionLO.get(c.answerIndex) : null;
      if (!lo && criterionId) {
        const q = questions.find((item) => (item.criteria || []).some((x) => String(typeof x === "object" ? x.id || x.criterionId || x.name : x) === criterionId));
        if (q) lo = resolveQuestionOutcome(q, outcomes);
      }
      if (!lo) return;

      const entry = ensureLO(lo, assessment);
      const weight = Number(c.weight ?? def?.weight ?? 1);
      const safeWeight = Number.isFinite(weight) && weight > 0 ? weight : 1;
      const score = Number(c.score);
      const bucketKey = `${sub.studentName || "student"}::${lo.id}::${sub.assessmentId || assessment.id}`;
      if (!studentBuckets.has(bucketKey)) studentBuckets.set(bucketKey, { lo, weighted: 0, weight: 0, studentName: sub.studentName });
      const bucket = studentBuckets.get(bucketKey);
      bucket.weighted += score * safeWeight;
      bucket.weight += safeWeight;

      const criterionName = (def && def.name) || c.name || prettifyId(c.criterionId) || "Kriteria";
      if (!entry.criteriaMap.has(criterionName)) entry.criteriaMap.set(criterionName, []);
      entry.criteriaMap.get(criterionName).push({ studentName: sub.studentName, score });
    });

    for (const bucket of studentBuckets.values()) {
      const entry = ensureLO(bucket.lo, assessment);
      entry.records.push({ studentName: bucket.studentName, score: bucket.weight ? bucket.weighted / bucket.weight : 0 });
    }
  });

  const out = [];
  for (const entry of loMap.values()) {
    if (!entry.records.length) continue;
    const avg = entry.records.reduce((sum, r) => sum + r.score, 0) / entry.records.length;
    const criteria = [...entry.criteriaMap.entries()].map(([name, records]) => ({
      name,
      records,
      avg: records.reduce((sum, r) => sum + r.score, 0) / records.length,
    })).sort((a, b) => b.avg - a.avg);
    const levels = entry.levels;
    const distribution = levels.map((l) => ({
      level: l,
      count: entry.records.filter((r) => levelScore(r.score, levels) === Number(l.score)).length,
    })).sort((a, b) => b.level.score - a.level.score);
    const maxCount = Math.max(0, ...distribution.map((d) => d.count));
    distribution.forEach((d) => {
      d.pct = entry.records.length ? Math.round((d.count / entry.records.length) * 100) : 0;
      d.dominant = d.count === maxCount && d.count > 0;
    });
    out.push({
      id: entry.id,
      name: entry.name,
      weight: entry.weight,
      levels,
      records: entry.records,
      avg,
      achieved: levelForScore(avg, levels),
      distribution,
      criteria,
      assessmentIds: [...entry.assessmentIds],
    });
  }
  return out.sort((a, b) => b.avg - a.avg);
}

const scoreClass = (n) => `sb-${Math.max(1, Math.min(4, Number(n)))}`;

export function renderCompetencyStudent(comps) {
  if (!comps || !comps.length) return `<p class="empty-state">Belum ada data Learning Outcome untuk ditampilkan.</p>`;
  return `
    <div class="competency-simple">
      ${comps.map((c) => `
        <div class="competency-row competency-lo-row">
          <div class="competency-info">
            <strong>${escapeHtml(c.id)} — ${escapeHtml(c.name)}</strong>
            <span class="rubrik-muted">${c.records.length} evidence · kompetensi berbasis Learning Outcome</span>
            ${c.criteria?.length ? `<span class="rubrik-muted">Evidence: ${c.criteria.slice(0, 3).map((x) => `${escapeHtml(x.name)} (${Math.round(x.avg)})`).join(" · ")}</span>` : ""}
          </div>
          <div class="rubrik-skor">
            <span class="rubrik-score-badge ${scoreClass(c.achieved?.score || 1)}">${Math.round(c.avg)}</span>
            <span class="rubrik-muted">/100</span>
          </div>
        </div>`).join("")}
    </div>`;
}

export function renderCompetencyClass(comps) {
  if (!comps || !comps.length) {
    return `<p class="empty-state">Belum ada data Learning Outcome. Pastikan setiap Learning Outcome terpetakan ke minimal satu soal dan soal memiliki evidence tervalidasi.</p>`;
  }
  return `
    <div class="competency-simple">
      ${comps.map((c) => `
        <div class="competency-row competency-lo-row">
          <div class="competency-info">
            <strong>${escapeHtml(c.id)} — ${escapeHtml(c.name)}</strong>
            <span class="rubrik-muted">${c.records.length} evidence · ${c.assessmentIds.length} assessment</span>
            ${c.criteria?.length ? `<span class="rubrik-muted">Kriteria pendukung: ${c.criteria.slice(0, 3).map((x) => `${escapeHtml(x.name)} (${Math.round(x.avg)})`).join(" · ")}</span>` : ""}
          </div>
          <div class="rubrik-skor">
            <span class="rubrik-score-badge ${scoreClass(c.achieved?.score || 1)}">${Math.round(c.avg)}</span>
            <span class="rubrik-muted">/100</span>
          </div>
        </div>`).join("")}
    </div>`;
}
