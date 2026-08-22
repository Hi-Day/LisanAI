/**
 * Verification plugin — after evaluation, checks:
 *  1. score valid
 *  2. evidence available
 *  3. evidence grounded in answer
 *  4. rationale consistent
 *  5. all criteria present
 *  6. schema compliance
 */
const { validateCriterionEvaluation } = require("../validator");

module.exports = {
  name: "verification",
  version: "1.0.0",
  async after(context, result) {
    const issues = [];
    const rubric = result.rubric || context.rubric || { criteria: [] };
    const rubricIds = new Set((rubric.criteria || []).map((c) => c.id));
    const resultIds = new Set((result.criteria || []).map((c) => c.criterionId));

    // 1+5. Criteria present and complete.
    for (const rid of rubricIds) {
      if (!resultIds.has(rid)) issues.push(`Criterion '${rid}' tidak dievaluasi`);
    }

    // 2/3/4. Per-criterion checks.
    for (const criterion of result.criteria || []) {
      const check = validateCriterionEvaluation(criterion, rubric);
      if (!check.valid) issues.push(...check.issues);
      if (!Array.isArray(criterion.evidence) || criterion.evidence.length === 0) {
        issues.push(`Criterion '${criterion.criterionId}' tidak memiliki evidence`);
      } else {
        const ungrounded = criterion.evidence.filter((ev) => ev && ev.grounded === false);
        if (ungrounded.length > 0) {
          issues.push(`Criterion '${criterion.criterionId}' punya evidence yang tidak grounded`);
        }
      }
    }

    result.verification = {
      valid: issues.length === 0,
      issues,
    };
    context.trace &&
      context.trace.event("VERIFICATION_RUN", { valid: result.verification.valid, issueCount: issues.length });
    return result;
  },
};

function validateCriterion(criterion, rubric) {
  const check = validateCriterionEvaluation(criterion, rubric);
  const issues = [...check.issues];
  if (typeof criterion.confidence === "number" && (criterion.confidence < 0 || criterion.confidence > 1)) {
    issues.push(`Criterion '${criterion.criterionId}' confidence di luar [0,1]`);
  }
  return { valid: issues.length === 0, issues };
}