/**
 * P1-4 / P1-5 / P1-17 — Risk scoring, classification, and the evaluation policy
 * engine.
 *
 * Adaptive verification decides how much verification a result needs, based on
 * how confident the model is and how risky the evaluation looks. It is a
 * PURELY ADDITIVE layer over the deterministic verification gate.
 *
 * SAFETY INVARIANTS (PRD §34), enforced here and relied upon by the harness:
 *   - Risk NEVER mutates the numeric final score. It only affects the
 *     publication/review treatment.
 *   - Risk can only escalate (PASS → REVIEW) or flag for human review / retry.
 *     It can NEVER downgrade REVIEW → PASS.
 *   - Evidence validation and the verification gate always run regardless of
 *     risk; risk never bypasses them.
 *   - Reliability/risk NEVER automatically change a student's grade.
 */

/**
 * Clamp a value to [0,1].
 */
function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function std(values) {
  const xs = values.filter((v) => Number.isFinite(Number(v))).map(Number);
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}

function round(v, places = 4) {
  const f = 10 ** places;
  return Math.round((v + Number.EPSILON) * f) / f;
}

/**
 * Difficulty as a risk coefficient [0,1]: sulit → 1 (riskier), mudah → 0.
 */
function difficultyCoefficient(difficulty) {
  const d = String(difficulty || "").toLowerCase();
  if (d.includes("sulit") || d.includes("keras") || d.includes("hard")) return 1;
  if (d.includes("sedang") || d.includes("medium")) return 0.5;
  return 0;
}

/**
 * Evidence-risk coefficient [0,1] derived from the verification issues.
 * The presence of evidence problems is a strong risk signal (the result cannot
 * be trusted even if the model was confident).
 */
function evidenceRiskCoefficient(verification) {
  const issues = (verification && verification.issues) || [];
  if (!issues.length) return 0;
  const evidenceTypes = new Set([
    "NO_EVIDENCE",
    "UNGROUNDED_EVIDENCE",
    "MISSING_CRITERION",
    "SCHEMA_INVALID",
  ]);
  const matched = issues.filter((i) => {
    const t = String(i && i.type || "").toUpperCase();
    return evidenceTypes.has(t);
  }).length;
  if (matched === 0) return 0;
  return round(Math.min(1, matched / Math.max(1, issues.length) + 0.3), 4);
}

/**
 * Score-extremity + criterion-disagreement coefficient [0,1].
 * Extreme scores (near 0 or 100) and high variance across criteria both make a
 * judgment riskier.
 */
function scoreRiskCoefficient(criteria) {
  const scores = (criteria || []).map((c) => Number(c.score)).filter((v) => Number.isFinite(v));
  if (!scores.length) return 0.5;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const extremity = Math.abs(mean - 50) / 50; // 0 at 50, 1 at 0 or 100
  const s = std(scores);
  const spread = Math.min(1, s / 25);
  return round(0.5 * extremity + 0.5 * spread, 4);
}

/**
 * Anomaly coefficient [0,1]: a FAIL verification, or recent repeated failures
 * on the same assessment, push risk up. (History is supplied by the caller.)
 */
function anomalyCoefficient(verification, history = {}) {
  const v = verification || {};
  let base = 0;
  if (v.status === "FAIL") base = 1;
  else if (v.status === "REVIEW") base = 0.4;
  const recentFailures = Number(history.recentFailures || 0);
  if (recentFailures > 0) base = Math.min(1, base + 0.2 * recentFailures);
  return round(base, 4);
}

/**
 * Weighted risk score in [0,1].
 *
 *   risk = wConf·(1−confidence) + wEvid·evidenceRisk + wDisc·disagreement
 *        + wDiff·difficulty + wAnom·anomaly
 *
 * @param {object} input
 * @param {object[]} input.criteria  criterion evaluations (with .confidence, .score)
 * @param {object} input.verification  harness verification result
 * @param {number} [input.difficulty]  assessment difficulty
 * @param {object} [input.history]  { recentFailures }
 * @param {object} [weights]  overrides; default sums to 1
 */
function computeRiskScore(input, weights = {}) {
  const criteria = input.criteria || [];
  const verification = input.verification || {};

  const confidences = criteria.map((c) => Number(c.confidence)).filter((v) => Number.isFinite(v));
  const confidence = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;

  const w = { confidence: 0.25, evidence: 0.25, disagreement: 0.2, difficulty: 0.1, anomaly: 0.2, ...weights };
  const wSum = Object.values(w).reduce((a, b) => a + Number(b || 0), 0) || 1;

  const risk =
    (w.confidence * (1 - clamp01(confidence)) +
      w.evidence * evidenceRiskCoefficient(verification) +
      w.disagreement * scoreRiskCoefficient(criteria) +
      w.difficulty * difficultyCoefficient(input.difficulty) +
      w.anomaly * anomalyCoefficient(verification, input.history)) / wSum;

  return round(clamp01(risk), 4);
}

/**
 * Classify a risk score into LOW | MEDIUM | HIGH using the given thresholds.
 * Defaults follow PRD §9: 0–0.30 LOW, 0.31–0.60 MEDIUM, 0.61–1.00 HIGH.
 */
function classifyRisk(score, thresholds = {}) {
  const low = Number(thresholds.low != null ? thresholds.low : 0.3);
  const high = Number(thresholds.high != null ? thresholds.high : 0.6);
  const s = clamp01(score);
  if (s <= low) return "LOW";
  if (s <= high) return "MEDIUM";
  return "HIGH";
}

/**
 * Decide the treatment for a risk level under a policy (P1-5/P1-17).
 *
 * The policy decides HOW MUCH verification a result needs before publication.
 * It reads the existing verification gate but can only escalate:
 *   - LOW   → accept (no secondary verification)
 *   - MEDIUM→ verification (PASS → accept; otherwise REVIEW)
 *   - HIGH  → verification + retry, and force human review when still not clean
 *
 * It NEVER upgrades a verification REVIEW/PASS and NEVER touches the score.
 *
 * @returns {{
 *   decision: 'accept'|'verify'|'review'|'retry',
 *   requiresHumanReview: boolean,
 *   retry: number,
 *   policyVersion: string,
 * }}
 */
function applyPolicy(riskLevel, verification, policy = {}) {
  const policyVersion = policy.policyVersion || "evaluation-policy-v2";
  const retryMap = policy.retry || { low: 0, medium: 1, high: 1 };
  const verifMap = policy.verification || { low: false, medium: true, high: true };
  const gate = (verification && verification.status) || "PASS";

  const retry = Number(retryMap[String(riskLevel).toLowerCase()] || 0);
  const wantsVerification = verifMap[String(riskLevel).toLowerCase()] === true;

  let decision = "accept";
  let requiresHumanReview = false;

  if (riskLevel === "HIGH") {
    decision = "retry";
  } else if (riskLevel === "MEDIUM") {
    decision = "verify";
  } else {
    decision = "accept";
  }

  // The existing verification gate is authoritative: a non-PASS gate ALWAYS
  // requires human review regardless of risk. Risk can additionally escalate a
  // clean PASS to human review when it is HIGH and verification was wanted.
  if (gate === "REVIEW") {
    decision = "review";
    requiresHumanReview = true;
  } else if (gate === "FAIL") {
    decision = "retry";
    requiresHumanReview = true;
  } else if (wantsVerification && riskLevel === "HIGH") {
    decision = "review";
    requiresHumanReview = true;
  }

  return { decision, requiresHumanReview, retry, policyVersion };
}

module.exports = {
  computeRiskScore,
  classifyRisk,
  applyPolicy,
  difficultyCoefficient,
  evidenceRiskCoefficient,
  scoreRiskCoefficient,
  anomalyCoefficient,
};