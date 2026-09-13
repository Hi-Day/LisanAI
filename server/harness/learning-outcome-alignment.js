// ---------------------------------------------------------------------------
// Learning Outcome Alignment
// ---------------------------------------------------------------------------
// Pedagogical invariant:
//   Learning Outcome = competency/construct to be measured
//   Criterion       = observable evidence dimension
//   Question        = instrument that elicits evidence
//
// Every targeted learning outcome in an assessment must be measurable by at
// least one question. Criteria inherit an explicit LO mapping from the
// question(s) that use them; they are never treated as class competencies.

function normalizeText(value) {
  return String(value == null ? "" : value)
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseLearningOutcomes(value) {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (typeof item === "string") return { id: `LO${index + 1}`, text: item.trim() };
      return {
        id: String(item?.id || item?.learningOutcomeId || `LO${index + 1}`).trim(),
        text: String(item?.text || item?.name || item?.title || item?.outcome || "").trim(),
      };
    }).filter((item) => item.text);
  }

  const text = String(value || "").trim();
  if (!text) return [];
  const parts = text.split(/\r?\n|\s*;\s*/).map((line) => line.trim()).filter(Boolean);

  return parts.map((line, index) => {
    const match = line.match(/^(?:[-*•]\s*)?(?:LO|CPL|CPMK|Learning Outcome)\s*[-#:.)]?\s*(\d+)\s*[-:.):]?\s*(.+)$/i);
    if (match) return { id: `LO${match[1]}`, text: match[2].trim() };
    const numbered = line.match(/^(?:[-*•]\s*)?(\d+)[.)]\s*(.+)$/);
    if (numbered) return { id: `LO${numbered[1]}`, text: numbered[2].trim() };
    return { id: `LO${index + 1}`, text: line };
  });
}

function resolveLearningOutcome(question, outcomes) {
  const list = outcomes || [];
  const explicitId = String(question?.learningOutcomeId || question?.outcomeId || "").trim();
  if (explicitId) {
    const exact = list.find((lo) => String(lo.id).toLowerCase() === explicitId.toLowerCase());
    if (exact) return exact;
  }

  const outcomeText = normalizeText(question?.outcome || "");
  if (outcomeText) {
    const exact = list.find((lo) => normalizeText(lo.text) === outcomeText);
    if (exact) return exact;
    const contains = list.find((lo) => {
      const a = normalizeText(lo.text);
      return a && (a.includes(outcomeText) || outcomeText.includes(a));
    });
    if (contains) return contains;
  }
  return null;
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
  const questionTokens = learningOutcomeTokens([
    question?.prompt,
    question?.focus,
    question?.outcome,
  ].filter(Boolean).join(" "));
  const outcomeTokens = learningOutcomeTokens(outcome?.text);
  let score = 0;
  outcomeTokens.forEach((token) => {
    if (questionTokens.has(token)) score += 1;
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
 * Plan LO -> question mapping BEFORE asking the model to write questions.
 *
 * The plan is deterministic so the pedagogical coverage decision does not
 * depend on model output. If there are at least as many questions as LOs,
 * every LO gets its own question first and remaining questions are balanced
 * across LOs. If there are fewer questions than LOs, related LOs are grouped
 * into the same question using lexical similarity, with a maximum group size
 * derived from ceil(LO count / question count).
 */
function buildLearningOutcomeQuestionPlan(outcomes, questionCount) {
  const list = Array.isArray(outcomes) ? outcomes.filter((lo) => lo?.id && lo?.text) : [];
  const count = Math.max(0, Number(questionCount || 0));
  if (!list.length || !count) return [];

  if (count >= list.length) {
    const assignments = Array.from({ length: count }, () => []);
    list.forEach((lo, index) => { assignments[index].push(lo); });
    for (let i = list.length; i < count; i += 1) {
      const counts = list.map((lo) => assignments.filter((group) => group.some((item) => item.id === lo.id)).length);
      const targetIndex = counts.indexOf(Math.min(...counts));
      assignments[i].push(list[targetIndex]);
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
    let bestI = 0;
    let bestJ = 1;
    let bestScore = -1;
    for (let i = 0; i < groups.length; i += 1) {
      for (let j = i + 1; j < groups.length; j += 1) {
        if (groups[i].length + groups[j].length > maxPerQuestion) continue;
        const pairs = groups[i].flatMap((a) => groups[j].map((b) => learningOutcomeSimilarity(a, b)));
        const score = pairs.length ? Math.max(...pairs) : 0;
        if (score > bestScore) { bestScore = score; bestI = i; bestJ = j; }
      }
    }
    if (bestScore < 0) { bestI = 0; bestJ = 1; }
    groups[bestI] = groups[bestI].concat(groups[bestJ]);
    groups.splice(bestJ, 1);
  }

  return groups.map((los, questionIndex) => ({
    questionIndex,
    learningOutcomes: los.map((lo) => ({ id: lo.id, text: lo.text })),
    learningOutcomeIds: los.map((lo) => lo.id),
  }));
}

function ensureLearningOutcomeCoverage(questions, outcomes) {
  const list = Array.isArray(outcomes) ? outcomes : [];
  const result = (questions || []).map((question) => ({ ...question }));
  if (!list.length || !result.length) return result;

  const assigned = new Map();
  result.forEach((question, index) => {
    const lo = resolveLearningOutcome(question, list);
    if (lo) assigned.set(index, lo);
  });

  const counts = () => {
    const map = new Map(list.map((lo) => [lo.id, 0]));
    assigned.forEach((lo) => map.set(lo.id, (map.get(lo.id) || 0) + 1));
    return map;
  };

  const findCandidate = (missing, currentCounts) => {
    const candidates = result.map((question, index) => {
      const current = assigned.get(index);
      if (!current) return { index, current: null, priority: 0, score: questionLearningOutcomeScore(question, missing) };
      const canReassign = (currentCounts.get(current.id) || 0) > 1;
      if (!canReassign) return null;
      return { index, current, priority: 1, score: questionLearningOutcomeScore(question, missing) };
    }).filter(Boolean);
    candidates.sort((a, b) => a.priority - b.priority || b.score - a.score || a.index - b.index);
    return candidates[0] || null;
  };

  for (const missing of list) {
    const currentCounts = counts();
    if ((currentCounts.get(missing.id) || 0) > 0) continue;
    const candidate = findCandidate(missing, currentCounts);
    if (!candidate) continue;
    assigned.set(candidate.index, missing);
    result[candidate.index] = { ...result[candidate.index], learningOutcomeId: missing.id, outcome: missing.text };
  }

  result.forEach((question, index) => {
    if (assigned.has(index)) return;
    const best = list.map((lo, outcomeIndex) => ({ lo, score: questionLearningOutcomeScore(question, lo), outcomeIndex }))
      .sort((a, b) => b.score - a.score || a.outcomeIndex - b.outcomeIndex)[0];
    if (!best) return;
    assigned.set(index, best.lo);
    result[index] = { ...result[index], learningOutcomeId: best.lo.id, outcome: best.lo.text };
  });

  return result.map((question, index) => {
    const lo = assigned.get(index);
    return lo ? { ...question, learningOutcomeId: lo.id, outcome: lo.text } : question;
  });
}

function mapCriteriaToLearningOutcomes(questions, outcomes) {
  const byCriterion = new Map();
  const byQuestion = questionOutcomeMap(questions, outcomes);
  (questions || []).forEach((question, index) => {
    const lo = byQuestion.get(index);
    if (!lo) return;
    (Array.isArray(question?.criteria) ? question.criteria : []).forEach((criterion) => {
      const id = String(typeof criterion === "object" ? criterion.id || criterion.criterionId || criterion.name : criterion || "").trim();
      if (!id) return;
      if (!byCriterion.has(id)) byCriterion.set(id, []);
      const list = byCriterion.get(id);
      if (!list.some((item) => item.id === lo.id)) list.push(lo);
    });
  });
  return { byCriterion, byQuestion };
}

function coverageReport(questions, outcomes) {
  const list = outcomes || [];
  const byQuestion = questionOutcomeMap(questions, list);
  const covered = new Set([...byQuestion.values()].map((lo) => lo.id));
  const missing = list.filter((lo) => !covered.has(lo.id));
  return {
    total: list.length,
    covered: list.filter((lo) => covered.has(lo.id)),
    missing,
    coveragePercent: list.length ? Math.round((covered.size / list.length) * 100) : 100,
    questionMap: byQuestion,
  };
}

function validateLearningOutcomeCoverage(questions, outcomes) {
  const report = coverageReport(questions, outcomes);
  if (report.missing.length) {
    const error = new Error(`Assessment belum mengukur semua learning outcome: ${report.missing.map((lo) => `${lo.id} — ${lo.text}`).join("; ")}`);
    error.code = "LEARNING_OUTCOME_COVERAGE_INCOMPLETE";
    error.coverage = {
      total: report.total,
      covered: report.covered.map((lo) => lo.id),
      missing: report.missing.map((lo) => ({ id: lo.id, text: lo.text })),
      coveragePercent: report.coveragePercent,
    };
    throw error;
  }
  return report;
}

function enrichQuestionLearningOutcome(question, outcomes) {
  const lo = resolveLearningOutcome(question, outcomes);
  if (!lo) return question;
  return { ...question, learningOutcomeId: lo.id, outcome: lo.text };
}

module.exports = {
  normalizeText,
  parseLearningOutcomes,
  resolveLearningOutcome,
  questionOutcomeMap,
  mapCriteriaToLearningOutcomes,
  coverageReport,
  validateLearningOutcomeCoverage,
  enrichQuestionLearningOutcome,
  ensureLearningOutcomeCoverage,
  buildLearningOutcomeQuestionPlan,
};