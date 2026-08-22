/**
 * Verification plugin — after evaluation, checks:
 *  1. score valid
 *  2. evidence available
 *  3. evidence grounded in answer
 *  4. rationale consistent
 *  5. all criteria present
 *  6. schema compliance
 *
 * PRD FR-08 (Verification Gate):
 *   Produces a gate decision: PASS | REVIEW | FAIL.
 *   - PASS   → assessment can be published.
 *   - REVIEW → low-confidence / needs human review.
 *   - FAIL   → evaluation must not be published as final result.
 *
 * PRD FR-06 (Evidence-Score Consistency):
 *   A high score with weak evidence coverage triggers REVIEW.
 */
const { validateCriterionEvaluation } = require("../validator");

// Configurable thresholds (PRD FR-06).
const DEFAULT_THRESHOLDS = {
  evidenceCoverage: 0.5, // fraction of criteria that must have grounded evidence
  highScoreThreshold: 70, // score above this with weak coverage → REVIEW
};

module.exports = {
  name: "verification",
  version: "2.0.0",
  async after(context, result) {
    const thresholds = {
      ...DEFAULT_THRESHOLDS,
      ...((context.config && context.config.verification) || {}),
    };
    // `fatalIssues` → FAIL (cannot publish). `issues` also includes soft
    // observations used for the trace; ungrounded evidence or weak coverage
    // only downgrade where possible to REVIEW.
    const fatalIssues = [];
    const issues = [];
    const rubric = result.rubric || context.rubric || { criteria: [] };
    const rubricIds = new Set((rubric.criteria || []).map((c) => c.id));
    const resultIds = new Set((result.criteria || []).map((c) => c.criterionId));

    // 1+5. Criteria present and complete.
    for (const rid of rubricIds) {
      if (!resultIds.has(rid)) {
        const msg = `Criterion '${rid}' tidak dievaluasi`;
        fatalIssues.push(msg);
        issues.push(msg);
      }
    }

    // 2/3/4. Per-criterion checks.
    for (const criterion of result.criteria || []) {
      const check = validateCriterionEvaluation(criterion, rubric);
      if (!check.valid) {
        fatalIssues.push(...check.issues);
        issues.push(...check.issues);
      }
      if (!Array.isArray(criterion.evidence) || criterion.evidence.length === 0) {
        const msg = `Criterion '${criterion.criterionId}' tidak memiliki evidence`;
        fatalIssues.push(msg);
        issues.push(msg);
      } else {
        const ungrounded = criterion.evidence.filter((ev) => ev && ev.grounded === false);
        if (ungrounded.length > 0) {
          // Not fatal on its own — lowers coverage → likely REVIEW.
          issues.push(`Criterion '${criterion.criterionId}' punya evidence yang tidak grounded`);
        }
      }
    }

    // FR-06: evidence-score consistency.
    const scoreConsistency = checkScoreConsistency(result.criteria || [], thresholds);

    const gate = decideGate(fatalIssues, issues, scoreConsistency, thresholds);

    result.verification = {
      valid: fatalIssues.length === 0,
      issues,
      status: gate.status,
      reasons: gate.reasons,
      scoreConsistency,
    };
    context.trace &&
      context.trace.event("VERIFICATION_RUN", {
        valid: result.verification.valid,
        status: result.verification.status,
        issueCount: issues.length,
      });
    return result;
  },
};

/**
 * Compute evidence coverage + detect high-score-with-weak-evidence anomalies.
 */
function checkScoreConsistency(criteria, thresholds) {
  const scored = criteria.filter((c) => typeof c.score === "number");
  if (scored.length === 0) {
    return { coverage: 0, anomalies: [] };
  }
  const withGroundedEvidence = scored.filter(
    (c) => Array.isArray(c.evidence) && c.evidence.some((ev) => ev && ev.grounded === true)
  );
  const coverage = withGroundedEvidence.length / scored.length;
  const anomalies = [];
  for (const c of scored) {
    const hasGrounded = Array.isArray(c.evidence) && c.evidence.some((ev) => ev && ev.grounded === true);
    if (!hasGrounded && c.score >= thresholds.highScoreThreshold) {
      anomalies.push(
        `Criterion '${c.criterionId}' score ${c.score} tinggi tanpa evidence grounded`
      );
    }
  }
  return { coverage, anomalies };
}

/**
 * Decide PASS / REVIEW / FAIL.
 *  - FAIL: fatal issues (missing criterion, invalid score, no evidence at all).
 *  - REVIEW: weak evidence coverage, ungrounded evidence, or high-score-with-
 *    weak-evidence anomaly.
 *  - PASS: otherwise.
 */
function decideGate(fatalIssues, issues, scoreConsistency, thresholds) {
  const reasons = [];
  if (fatalIssues.length > 0) {
    reasons.push(...fatalIssues);
    return { status: "FAIL", reasons };
  }
  if (scoreConsistency.coverage < thresholds.evidenceCoverage) {
    reasons.push(
      `Evidence coverage ${(scoreConsistency.coverage * 100).toFixed(0)}% di bawah threshold ${(thresholds.evidenceCoverage * 100).toFixed(0)}%`
    );
  }
  reasons.push(...scoreConsistency.anomalies);
  if (reasons.length > 0) {
    return { status: "REVIEW", reasons };
  }
  return { status: "PASS", reasons: [] };
}

function validateCriterion(criterion, rubric) {
  const check = validateCriterionEvaluation(criterion, rubric);
  const issues = [...check.issues];
  if (typeof criterion.confidence === "number" && (criterion.confidence < 0 || criterion.confidence > 1)) {
    issues.push(`Criterion '${criterion.criterionId}' confidence di luar [0,1]`);
  }
  return { valid: issues.length === 0, issues };
}