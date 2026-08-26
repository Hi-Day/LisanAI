const crypto = require("node:crypto");
const { compileRubric, canonicalStringify } = require("./rubric-compiler");

/**
 * Evaluation Plan (PRD P0-2)
 *
 * After a rubric is compiled, the evaluation plan is built ONCE and becomes the
 * single source of truth for:
 *   - question -> criterion mapping
 *   - rubric version
 *   - evaluation configuration
 *   - prompt version
 *
 * It is validated eagerly so an invalid mapping stops BEFORE any LLM inference.
 *
 * A question's criterionIds are taken from its own `criteria` field (stamped at
 * generation/alignment time) when present; otherwise a deterministic best-fit
 * matcher assigns the rubric criterion whose name has the highest word-overlap
 * with the question content (ties broken by lower weight, then by id).
 */

const PLAN_VERSION = "v1";

function hashValue(value) {
  return crypto.createHash("sha256").update(canonicalStringify(value)).digest("hex");
}

function normTokens(text) {
  return new Set(
    String(text || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2)
  );
}

/**
 * Deterministic best-fit: highest overlap between question text/focus/outcome
 * and a rubric criterion name. Ties -> higher weight, then lower id.
 * Returns a criterion or null when nothing matches.
 */
function bestFit(question, rubricCriteria) {
  const source = `${question.prompt || ""} ${question.focus || ""} ${question.outcome || ""}`;
  const tokens = normTokens(source);
  let best = null;
  let bestOverlap = -1;
  for (const c of rubricCriteria) {
    const nameTokens = normTokens(c.name);
    let overlap = 0;
    for (const t of nameTokens) if (tokens.has(t)) overlap += 1;
    if (
      overlap > bestOverlap ||
      (overlap === bestOverlap &&
        best &&
        (Number(c.weight) > Number(best.weight) ||
          (Number(c.weight) === Number(best.weight) && String(c.id) < String(best.id))))
    ) {
      bestOverlap = overlap;
      best = c;
    }
  }
  // A zero-overlap "match" is not a real mapping.
  return best && bestOverlap > 0 ? best.id : null;
}

/**
 * Resolve the criterion ids for one question.
 * @param {object} question
 * @param {object[]} rubricCriteria  compiled rubric criteria
 * @param {Map} byId  id -> criterion
 */
function resolveCriterionIds(question, rubricCriteria, byId) {
  const declared = Array.isArray(question.criteria) ? question.criteria : [];
  const ids = [];
  for (const d of declared) {
    const id = String(typeof d === "object" ? d.id || d.criterionId || d.name || "" : d).trim();
    if (id && byId.has(id) && !ids.includes(id)) ids.push(id);
  }
  if (declared.length > 0) {
    // The question explicitly declared criteria: a mapping must be VALID, not
    // silently re-fitted. Invalid declared criteria stop the plan (P0-2).
    if (ids.length === 0) {
      throw new Error(
        `Question '${question.questionId || question.id || ""}' mendeklarasikan criterion yang tidak ada di rubric`
      );
    }
    return ids;
  }
  // No declared criteria -> deterministic best-fit on content.
  const fit = bestFit(question, rubricCriteria);
  return fit ? [fit] : [];
}

/**
 * Build + validate the evaluation plan.
 * @param {object} input
 * @param {object[]} input.questions [{ index, questionId?, prompt, focus?, outcome?, criteria? }]
 * @param {object} input.rubric      raw rubric (compiled internally)
 * @param {string} [input.assessmentId]
 * @returns {{
 *   evaluationPlanId, assessmentId, rubricVersion, rubricHash, planVersion,
 *   questions: [{index, questionId, prompt, criterionIds}],
 *   uncoveredCriterionIds, promptVersion,
 * }}
 */
function buildEvaluationPlan({ questions, rubric, assessmentId } = {}) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("Evaluation Plan membutuhkan questions array non-empty");
  }
  const compiled = compileRubric({ rubric });
  const byId = new Map(compiled.criteria.map((c) => [c.id, c]));

  const seenQuestionIds = new Set();
  const planQuestions = questions.map((q, index) => {
    const questionId = String(q.questionId || q.id || `q${index + 1}`);
    if (seenQuestionIds.has(questionId)) {
      throw new Error(`questionId duplikat dalam plan: '${questionId}'`);
    }
    seenQuestionIds.add(questionId);

    const criterionIds = resolveCriterionIds(q, compiled.criteria, byId);
    if (criterionIds.length === 0) {
      throw new Error(
        `Question '${questionId}' tidak memiliki criterion mapping valid (unknown atau tidak cocok dengan rubric)`
      );
    }
    return {
      index,
      questionId,
      prompt: String(q.prompt || "").trim(),
      criterionIds,
    };
  });

  // Coverage: which rubric criteria are not measured by any question. Reported
  // (not fatal) so callers can warn without silently dropping a criterion.
  const covered = new Set();
  for (const pq of planQuestions) pq.criterionIds.forEach((id) => covered.add(id));
  const uncoveredCriterionIds = compiled.criteria.map((c) => c.id).filter((id) => !covered.has(id));

  const hash = hashValue({
    planVersion: PLAN_VERSION,
    rubricHash: compiled.hash,
    questions: planQuestions.map((q) => ({ questionId: q.questionId, criterionIds: q.criterionIds })),
  });

  return {
    evaluationPlanId: `plan_${hash.slice(0, 12)}`,
    assessmentId: assessmentId || null,
    rubricVersion: compiled.version,
    rubricHash: compiled.hash,
    planVersion: PLAN_VERSION,
    questions: planQuestions,
    uncoveredCriterionIds,
  };
}

module.exports = {
  buildEvaluationPlan,
  bestFit,
  PLAN_VERSION,
};