// ---------------------------------------------------------------------------
// Learning Outcome Alignment
// ---------------------------------------------------------------------------
// Pedagogical invariant:
//   Learning Outcome = competency/construct to be measured
//   Criterion       = observable evidence dimension
//   Question        = instrument that elicits evidence

function normalizeText(value) {
  return String(value == null ? "" : value).toLowerCase().replace(/[^a-z0-9\u00C0-\u024F]+/gi, " ").replace(/\s+/g, " ").trim();
}

function parseLearningOutcomes(value) {
  if (Array.isArray(value)) return value.map((item, index) => {
    if (typeof item === "string") return { id: `LO${index + 1}`, text: item.trim() };
    return { id: String(item?.id || item?.learningOutcomeId || `LO${index + 1}`).trim(), text: String(item?.text || item?.name || item?.title || item?.outcome || "").trim() };
  }).filter((item) => item.text);
  const text = String(value || "").trim();
  if (!text) return [];
  return text.split(/\r?\n|\s*;\s*/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const match = line.match(/^(?:[-*•]\s*)?(?:LO|CPL|CPMK|Learning Outcome)\s*[-#:.)]?\s*(\d+)\s*[-:.):]?\s*(.+)$/i);
    if (match) return { id: `LO${match[1]}`, text: match[2].trim() };
    const numbered = line.match(/^(?:[-*•]\s*)?(\d+)[.)]\s*(.+)$/);
    if (numbered) return { id: `LO${numbered[1]}`, text: numbered[2].trim() };
    return { id: `LO${index + 1}`, text: line };
  });
}

function resolveLearningOutcomes(question, outcomes) {
  const list = outcomes || [];
  const ids = Array.isArray(question?.learningOutcomeIds) ? question.learningOutcomeIds : [];
  const explicitId = String(question?.learningOutcomeId || question?.outcomeId || "").trim();
  const requestedIds = [...ids.map(String), explicitId].map((id) => id.trim()).filter(Boolean);
  const resolved = requestedIds.map((id) => list.find((lo) => String(lo.id).toLowerCase() === id.toLowerCase())).filter(Boolean);
  if (resolved.length) return [...new Map(resolved.map((lo) => [lo.id, lo])).values()];

  const outcomeText = normalizeText(question?.outcome || "");
  if (!outcomeText) return [];
  const exact = list.filter((lo) => normalizeText(lo.text) === outcomeText);
  if (exact.length) return exact;
  const contains = list.filter((lo) => {
    const a = normalizeText(lo.text);
    return a && (a.includes(outcomeText) || outcomeText.includes(a));
  });
  return contains;
}

function resolveLearningOutcome(question, outcomes) {
  return resolveLearningOutcomes(question, outcomes)[0] || null;
}

function questionOutcomeMap(questions, outcomes) {
  const map = new Map();
  (questions || []).forEach((question, index) => {
    const lo = resolveLearningOutcome(question, outcomes);
    if (lo) map.set(index, lo);
  });
  return map;
}

function learningOutcomeTokens(text) {
  return new Set(normalizeText(text).split(" ").filter((token) => token.length >= 4));
}

function questionLearningOutcomeScore(question, outcome) {
  const promptTokens = learningOutcomeTokens(question?.prompt || "");
  const focusTokens = learningOutcomeTokens(question?.focus || "");
  const outcomeTokens = learningOutcomeTokens(question?.outcome || "");
  const loTokens = learningOutcomeTokens(outcome?.text);
  let score = 0;
  loTokens.forEach((token) => {
    if (focusTokens.has(token)) score += 4;
    else if (promptTokens.has(token)) score += 1;
    if (outcomeTokens.has(token)) score += 2;
  });
  return score;
}

function learningOutcomeSimilarity(a, b) {
  const left = learningOutcomeTokens(a?.text);
  const right = learningOutcomeTokens(b?.text);
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  left.forEach((token) => { if (right.has(token)) intersection += 1; });
  return intersection / new Set([...left, ...right]).size;
}

/**
 * Decide the LO coverage plan BEFORE question generation.
 * - q >= LO: one LO per question first; extra questions are balanced.
 * - q < LO: related LOs are grouped into a question, constrained by the
 *   smallest group size needed to cover every LO.
 */
function buildLearningOutcomeQuestionPlan(outcomes, questionCount) {
  const list = Array.isArray(outcomes) ? outcomes.filter((lo) => lo?.id && lo?.text) : [];
  const count = Math.max(0, Number(questionCount || 0));
  if (!list.length || !count) return [];

  if (count >= list.length) {
    const assignments = Array.from({ length: count }, () => []);
    list.forEach((lo, index) => assignments[index].push(lo));
    for (let i = list.length; i < count; i += 1) {
      const frequencies = list.map((lo) => assignments.filter((group) => group.some((item) => item.id === lo.id)).length);
      const target = frequencies.indexOf(Math.min(...frequencies));
      assignments[i].push(list[target]);
    }
    return assignments.map((los, questionIndex) => ({
      questionIndex,
      learningOutcomes: los.map((lo) => ({ id: lo.id, text: lo.text })),
      learningOutcomeIds: los.map((lo) => lo.id),
    }));
  }

  const groups = list.map((lo) => [lo]);
  const maxPerQuestion = Math.ceil(list.length / count);
  while (groups.length > count) {
    let bestI = 0; let bestJ = 1; let bestScore = -1;
    for (let i = 0; i < groups.length; i += 1) for (let j = i + 1; j < groups.length; j += 1) {
      if (groups[i].length + groups[j].length > maxPerQuestion) continue;
      const score = Math.max(...groups[i].flatMap((a) => groups[j].map((b) => learningOutcomeSimilarity(a, b))));
      if (score > bestScore) { bestScore = score; bestI = i; bestJ = j; }
    }
    if (bestScore < 0) { bestI = 0; bestJ = 1; }
    groups[bestI] = groups[bestI].concat(groups[bestJ]);
    groups.splice(bestJ, 1);
  }
  return groups.map((los, questionIndex) => ({ questionIndex, learningOutcomes: los.map((lo) => ({ id: lo.id, text: lo.text })), learningOutcomeIds: los.map((lo) => lo.id) }));
}

/** Backward-compatible repair for legacy/generated question sets. */
function ensureLearningOutcomeCoverage(questions, outcomes) {
  const list = Array.isArray(outcomes) ? outcomes : [];
  const result = (questions || []).map((question) => ({ ...question }));
  if (!list.length || !result.length) return result;
  const assigned = new Map();
  result.forEach((question, index) => {
    const los = resolveLearningOutcomes(question, list);
    if (los.length) assigned.set(index, los);
  });
  const covered = () => new Set([...assigned.values()].flat().map((lo) => lo.id));
  for (const missing of list) {
    if (covered().has(missing.id)) continue;
    const candidate = result.findIndex((question, index) => !assigned.has(index) || assigned.get(index).length === 0);
    if (candidate < 0) break;
    assigned.set(candidate, [missing]);
  }
  result.forEach((question, index) => {
    if (assigned.has(index)) return;
    const best = list.map((lo, outcomeIndex) => ({ lo, score: questionLearningOutcomeScore(question, lo), outcomeIndex })).sort((a, b) => b.score - a.score || a.outcomeIndex - b.outcomeIndex)[0];
    if (best) assigned.set(index, [best.lo]);
  });
  return result.map((question, index) => {
    const los = assigned.get(index);
    if (!los?.length) return question;
    return { ...question, learningOutcomeIds: los.map((lo) => lo.id), learningOutcomeId: los[0].id, outcome: los.map((lo) => lo.text).join("; ") };
  });
}

function mapCriteriaToLearningOutcomes(questions, outcomes) {
  const byCriterion = new Map();
  const byQuestion = questionOutcomeMap(questions, outcomes);
  (questions || []).forEach((question, index) => {
    const los = resolveLearningOutcomes(question, outcomes);
    if (!los.length) return;
    (Array.isArray(question?.criteria) ? question.criteria : []).forEach((criterion) => {
      const id = String(typeof criterion === "object" ? criterion.id || criterion.criterionId || criterion.name : criterion || "").trim();
      if (!id) return;
      if (!byCriterion.has(id)) byCriterion.set(id, []);
      const mapped = byCriterion.get(id);
      los.forEach((lo) => { if (!mapped.some((item) => item.id === lo.id)) mapped.push(lo); });
    });
  });
  return { byCriterion, byQuestion };
}

function coverageReport(questions, outcomes) {
  const list = outcomes || [];
  const byQuestion = questionOutcomeMap(questions, list);
  const coveredIds = new Set();
  (questions || []).forEach((question) => resolveLearningOutcomes(question, list).forEach((lo) => coveredIds.add(lo.id)));
  const missing = list.filter((lo) => !coveredIds.has(lo.id));
  return { total: list.length, covered: list.filter((lo) => coveredIds.has(lo.id)), missing, coveragePercent: list.length ? Math.round((coveredIds.size / list.length) * 100) : 100, questionMap: byQuestion };
}

function validateLearningOutcomeCoverage(questions, outcomes) {
  const report = coverageReport(questions, outcomes);
  if (report.missing.length) {
    const error = new Error(`Assessment belum mengukur semua learning outcome: ${report.missing.map((lo) => `${lo.id} — ${lo.text}`).join("; ")}`);
    error.code = "LEARNING_OUTCOME_COVERAGE_INCOMPLETE";
    error.coverage = { total: report.total, covered: report.covered.map((lo) => lo.id), missing: report.missing.map((lo) => ({ id: lo.id, text: lo.text })), coveragePercent: report.coveragePercent };
    throw error;
  }
  return report;
}

function enrichQuestionLearningOutcome(question, outcomes) {
  const los = resolveLearningOutcomes(question, outcomes);
  if (!los.length) return question;
  return { ...question, learningOutcomeIds: los.map((lo) => lo.id), learningOutcomeId: los[0].id, outcome: los.map((lo) => lo.text).join("; ") };
}

module.exports = { normalizeText, parseLearningOutcomes, resolveLearningOutcome, resolveLearningOutcomes, questionOutcomeMap, mapCriteriaToLearningOutcomes, coverageReport, validateLearningOutcomeCoverage, enrichQuestionLearningOutcome, ensureLearningOutcomeCoverage, buildLearningOutcomeQuestionPlan };
