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
};
