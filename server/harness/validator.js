/**
 * Output validation — checks canonical evaluation output against schema.
 */
function validateRubric(rubric) {
  const issues = [];
  if (!rubric || typeof rubric !== "object") {
    issues.push("rubric harus berupa object");
    return { valid: false, issues };
  }
  if (!Array.isArray(rubric.criteria) || rubric.criteria.length === 0) {
    issues.push("rubric.criteria harus non-empty array");
  }
  if (Array.isArray(rubric.criteria)) {
    const sum = rubric.criteria.reduce((acc, c) => acc + Number(c.weight || 0), 0);
    if (Math.abs(sum - 1) > 1e-6) {
      issues.push(`sum(weight) harus 1, saat ini ${sum.toFixed(4)}`);
    }
    const seen = new Set();
    for (const c of rubric.criteria) {
      if (!c.id) issues.push("setiap criterion wajib punya id");
      else if (seen.has(c.id)) issues.push(`criterion id duplikat: ${c.id}`);
      seen.add(c.id);
    }
  }
  return { valid: issues.length === 0, issues };
}

/**
 * Schema-validate a single criterion evaluation.
 * @returns {{valid:boolean, issues:string[]}}
 */
function validateCriterionEvaluation(criterion, rubric) {
  const issues = [];
  if (!criterion) {
    issues.push("criterion evaluation null/undefined");
    return { valid: false, issues };
  }
  if (!criterion.criterionId) issues.push("criterion.criterionId wajib");
  if (typeof criterion.score !== "number" || !Number.isFinite(criterion.score)) {
    issues.push(`criterion '${criterion.criterionId}' score harus angka`);
  } else if (criterion.score < 0 || criterion.score > 100) {
    issues.push(`criterion '${criterion.criterionId}' score ${criterion.score} di luar [0,100]`);
  }
  if (!Array.isArray(criterion.evidence)) issues.push(`criterion '${criterion.criterionId}' evidence harus array`);
  return { valid: issues.length === 0, issues };
}

function validateOutput(output) {
  const issues = [];
  if (!output || typeof output !== "object") {
    issues.push("output bukan object");
    return { valid: false, issues };
  }
  if (!output.evaluationId) issues.push("output.evaluationId wajib");
  if (!Array.isArray(output.criteria) || output.criteria.length === 0) {
    issues.push("output.criteria wajib non-empty array");
  }
  if (output.finalScore == null) issues.push("output.finalScore wajib");
  return { valid: issues.length === 0, issues };
}

module.exports = { validateRubric, validateCriterionEvaluation, validateOutput };