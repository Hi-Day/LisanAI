/**
 * Evaluation metrics for research (PRD §21).
 * Validity: Pearson, Spearman, MAE, RMSE
 * Reliability: inter-run variance, score stddev, exact/adjacent agreement
 * All functions are deterministic and dependency-free.
 */

function mean(xs) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function std(xs) {
  const n = xs.length;
  if (n === 0) return 0;
  const m = mean(xs);
  const variance = xs.reduce((a, b) => a + (b - m) ** 2, 0) / n;
  return Math.sqrt(variance);
}

/**
 * Pearson correlation coefficient between two arrays (both same length).
 */
function pearson(a, b) {
  if (a.length !== b.length || a.length === 0) return NaN;
  const n = a.length;
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i += 1) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y;
    da += x ** 2;
    db += y ** 2;
  }
  const denom = Math.sqrt(da * db);
  return denom === 0 ? NaN : num / denom;
}

/**
 * Spearman rank correlation coefficient.
 */
function spearman(a, b) {
  if (a.length !== b.length || a.length === 0) return NaN;
  const rankA = rank(a);
  const rankB = rank(b);
  return pearson(rankA, rankB);
}

function rank(xs) {
  const indexed = xs.map((v, i) => ({ v, i }));
  indexed.sort((x, y) => x.v - y.v);
  const ranks = new Array(xs.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) j += 1;
    const avg = (i + j) / 2 + 1; // 1-based avg rank for ties
    for (let k = i; k <= j; k += 1) ranks[indexed[k].i] = avg;
    i = j + 1;
  }
  return ranks;
}

function mae(a, b) {
  if (a.length === 0) return NaN;
  return a.reduce((acc, v, i) => acc + Math.abs(v - b[i]), 0) / a.length;
}

function rmse(a, b) {
  if (a.length === 0) return NaN;
  return Math.sqrt(a.reduce((acc, v, i) => acc + (v - b[i]) ** 2, 0) / a.length);
}

/**
 * Exact agreement: proportion of identical scores.
 */
function exactAgreement(a, b) {
  if (a.length === 0) return NaN;
  let same = 0;
  for (let i = 0; i < a.length; i += 1) if (a[i] === b[i]) same += 1;
  return same / a.length;
}

/**
 * Adjacent agreement: proportion where |a-b| <= tolerance (default 5 pts).
 */
function adjacentAgreement(a, b, tolerance = 5) {
  if (a.length === 0) return NaN;
  let ok = 0;
  for (let i = 0; i < a.length; i += 1) if (Math.abs(a[i] - b[i]) <= tolerance) ok += 1;
  return ok / a.length;
}

/**
 * Inter-run variance across repeated AI scores for the same submissions.
 * @param runs array of arrays (each run = array of scores for each submission)
 */
function interRunVariance(runs) {
  const nSub = runs[0] ? runs[0].length : 0;
  const variances = [];
  for (let s = 0; s < nSub; s += 1) {
    const scores = runs.map((r) => r[s]);
    variances.push(std(scores) ** 2);
  }
  return mean(variances);
}

/**
 * Full research metrics between AI and human score vectors.
 */
function evaluateMetrics(ai, human) {
  return {
    n: ai.length,
    validity: {
      pearson: pearson(ai, human),
      spearman: spearman(ai, human),
      mae: mae(ai, human),
      rmse: rmse(ai, human),
    },
    reliability: {
      aiStd: std(ai),
      exactAgreement: exactAgreement(ai, human),
      adjacentAgreement: adjacentAgreement(ai, human),
    },
  };
}

// ---------------------------------------------------------------------------
// Confidence Calibration (P1-6 / P1-8)
// ---------------------------------------------------------------------------

/**
 * Partition confidence+correctness pairs into bins and return each bin's
 * average confidence, empirical accuracy (correctness rate) and count.
 *
 * @param {number[]} confidence   predicted probabilities in [0,1]
 * @param {number[]} correctness  empirical correctness, 0 or 1, same length
 * @param {number} [bins=10]      number of equal-width bins in [0,1]
 * @returns {{bins: Array<{confidence:number, accuracy:number, count:number}>, n:number}}
 */
function calibrationBins(confidence, correctness, bins = 10) {
  if (confidence.length !== correctness.length || confidence.length === 0) {
    return { bins: [], n: 0 };
  }
  const out = Array.from({ length: bins }, (_, i) => ({
    low: i / bins,
    high: (i + 1) / bins,
    confidenceSum: 0,
    correctnessSum: 0,
    count: 0,
  }));
  let n = 0;
  for (let i = 0; i < confidence.length; i += 1) {
    const c = clamp01(confidence[i]);
    const idx = Math.min(bins - 1, Math.floor(c * bins));
    out[idx].confidenceSum += c;
    out[idx].correctnessSum += correctness[i] === 1 || correctness[i] === true ? 1 : 0;
    out[idx].count += 1;
    n += 1;
  }
  return {
    n,
    bins: out.map((b) => ({
      low: b.low,
      high: b.high,
      confidence: b.count ? round(b.confidenceSum / b.count, 4) : null,
      accuracy: b.count ? round(b.correctnessSum / b.count, 4) : null,
      count: b.count,
    })),
  };
}

/**
 * Expected Calibration Error (P1-8). ECE = Σ_bin |accuracy − confidence| ×
 * (count/total). 0 = perfectly calibrated.
 */
function expectedCalibrationError(confidence, correctness, bins = 10) {
  const { bins: binList, n } = calibrationBins(confidence, correctness, bins);
  if (n === 0) return NaN;
  return round(
    binList.reduce((acc, b) => {
      if (!b.count) return acc;
      return acc + Math.abs(b.accuracy - b.confidence) * (b.count / n);
    }, 0),
    4
  );
}

/**
 * Brier score (P1-8). Brier = mean((confidence − correctness)^2). Lower is
 * better; 0 is perfect, 1 is worst for binary outcomes.
 */
function brierScore(confidence, correctness) {
  if (confidence.length === 0 || confidence.length !== correctness.length) return NaN;
  const sum = confidence.reduce((acc, c, i) => {
    const target = correctness[i] === 1 || correctness[i] === true ? 1 : 0;
    return acc + (clamp01(c) - target) ** 2;
  }, 0);
  return round(sum / confidence.length, 4);
}

// ---------------------------------------------------------------------------
// Score Stability / Repeatability (P1-10 / P1-11)
// ---------------------------------------------------------------------------

/**
 * Whether two scores for the same submission are "stable" (within tolerance).
 * Default tolerance follows PRD P1-11: SCORE_STABILITY_THRESHOLD = 10.
 */
function isScoreStable(scoreA, scoreB, tolerance = 10) {
  if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) return false;
  return Math.abs(scoreA - scoreB) <= tolerance;
}

/**
 * Repeatability across repeated runs of the same inputs.
 * Returns the fraction of repeated evaluations within tolerance, plus the mean
 * absolute difference and per-item stability flags.
 *
 * @param {Array<number[]|number>} runs  one array of scores per repeat, OR a
 *   flat array of scores for a single submission.
 * @param {number} [tolerance=10]
 */
function scoreStability(runs, tolerance = 10) {
  const arr = Array.isArray(runs) ? runs : [];
  if (arr.length === 0) return { n: 0, stableRatio: null, meanAbsDiff: null };
  // Flat single-submission vector: compare consecutive repeats.
  if (typeof arr[0] === "number") {
    const scores = arr.map(Number);
    if (scores.length < 2) return { n: scores.length, stableRatio: null, meanAbsDiff: null };
    const diffs = [];
    for (let i = 1; i < scores.length; i += 1) diffs.push(Math.abs(scores[i] - scores[i - 1]));
    const stable = diffs.filter((d) => d <= tolerance).length;
    return {
      n: scores.length,
      stableRatio: round(stable / diffs.length, 4),
      meanAbsDiff: round(diffs.reduce((a, b) => a + b, 0) / diffs.length, 4),
    };
  }
  // Matrix of runs × submissions: assess per-submission stability across runs.
  const nSub = arr[0] ? arr[0].length : 0;
  if (nSub === 0) return { n: 0, stableRatio: null, meanAbsDiff: null };
  const perSub = [];
  for (let s = 0; s < nSub; s += 1) {
    const scores = arr.map((r) => Number(r[s])).filter(Number.isFinite);
    if (scores.length < 2) continue;
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    perSub.push({ stable: isScoreStable(min, max, tolerance), spread: max - min });
  }
  if (perSub.length === 0) return { n: 0, stableRatio: null, meanAbsDiff: null };
  const meanSpread = perSub.reduce((a, b) => a + b.spread, 0) / perSub.length;
  const stableCount = perSub.filter((p) => p.stable).length;
  return {
    n: perSub.length,
    stableRatio: round(stableCount / perSub.length, 4),
    meanAbsDiff: round(meanSpread, 4),
  };
}

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function round(v, places = 4) {
  const f = 10 ** places;
  return Math.round((v + Number.EPSILON) * f) / f;
}

// ---------------------------------------------------------------------------
// Inter-Rater Reliability (PRD FR-20)
// ---------------------------------------------------------------------------

/**
 * Cohen's Kappa (unweighted) for two raters on nominal/categorical scores.
 * Inputs: two equal-length arrays of category labels (strings or numbers).
 * Returns a value in [-1, 1]; NaN when agreement is degenerate.
 *
 *   κ = (p_o - p_e) / (1 - p_e)
 */
function cohensKappa(a, b) {
  if (a.length !== b.length || a.length === 0) return NaN;
  const labels = new Set([...a, ...b]);
  const n = a.length;
  const row = new Map();
  const col = new Map();
  let observed = 0;
  for (let i = 0; i < n; i += 1) {
    row.set(a[i], (row.get(a[i]) || 0) + 1);
    col.set(b[i], (col.get(b[i]) || 0) + 1);
    if (a[i] === b[i]) observed += 1;
  }
  const pObserved = observed / n;
  let pExpected = 0;
  for (const label of labels) {
    pExpected += (row.get(label) || 0) * (col.get(label) || 0);
  }
  pExpected /= n * n;
  if (1 - pExpected === 0) return NaN;
  return (pObserved - pExpected) / (1 - pExpected);
}

/**
 * Weighted (quadratic) Kappa — Floyd & Cicchetti weighting for ordered
 * categorical scales. Treats both inputs as numeric ranks over the union of
 * observed categories; weights fall off quadratically with the distance
 * between categories, so near-misses count more than far misses.
 *
 * Formula (Cohen 1968, weighted):
 *
 *   κ_w = 1 − Σw·observed / Σw·expected
 */
function weightedKappa(a, b) {
  if (a.length !== b.length || a.length === 0) return NaN;
  const labels = [...new Set([...a, ...b])].sort((x, y) => x - y);
  const k = labels.length;
  if (k < 2) return NaN;
  const idx = new Map(labels.map((v, i) => [v, i]));
  const n = a.length;

  const W = (i, j) => {
    const d = i - j;
    return (d * d) / ((k - 1) * (k - 1));
  };

  const obs = Array.from({ length: k }, () => new Array(k).fill(0));
  const iaRow = new Array(k).fill(0);
  const ibCol = new Array(k).fill(0);
  for (let i = 0; i < n; i += 1) {
    const x = idx.get(a[i]);
    const y = idx.get(b[i]);
    obs[x][y] += 1;
    iaRow[x] += 1;
    ibCol[y] += 1;
  }

  let sumWObs = 0;
  let sumWExp = 0;
  for (let i = 0; i < k; i += 1) {
    for (let j = 0; j < k; j += 1) {
      const w = W(i, j);
      sumWObs += obs[i][j] * w;
      sumWExp += ((iaRow[i] * ibCol[j]) / n) * w;
    }
  }
  // Weighted proportions: weight observed/expected disagreements.
  const po = sumWObs / n;
  const pe = sumWExp / n;
  if (pe === 0) return NaN;
  return 1 - po / pe;
}

/**
 * Intraclass Correlation Coefficient (ICC), two-way/mixed absolute-agreement
 * single-measures formulation (Shrout & Fleiss ICC(2,k) mean-based variant).
 * Uses an ANOVA model over raters × subjects.
 * @param {number[][]} matrix  rows = subjects, columns = raters
 * @returns {{icc:number, nSubjects, nRaters, msSubjects, msError}}
 */
function iccTwoWay(matrix) {
  const rows = matrix.length;
  if (rows === 0) return { icc: NaN };
  const cols = matrix[0].length;
  if (cols < 2) return { icc: NaN };

  const grandMean = matrix.flat().reduce((a, b) => a + b, 0) / (rows * cols);
  // Row (subject) means.
  const rowMeans = matrix.map((r) => mean(r));
  // Column (rater) means.
  const colMeans = [];
  for (let j = 0; j < cols; j += 1) {
    let s = 0;
    for (let i = 0; i < rows; i += 1) s += matrix[i][j];
    colMeans.push(s / rows);
  }

  // SS total.
  let ssTotal = 0;
  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) ssTotal += (matrix[i][j] - grandMean) ** 2;
  }
  // SS between subjects (rows).
  let ssRows = 0;
  for (let i = 0; i < rows; i += 1) ssRows += cols * (rowMeans[i] - grandMean) ** 2;
  // SS between raters (columns).
  let ssCols = 0;
  for (let j = 0; j < cols; j += 1) ssCols += rows * (colMeans[j] - grandMean) ** 2;
  // SS error = total - rows - cols.
  const ssError = ssTotal - ssRows - ssCols;

  const dfRows = rows - 1;
  const dfCols = cols - 1;
  const dfError = (rows - 1) * (cols - 1);
  const msr = ssRows / dfRows; // variance between subjects
  const msw = ssError / dfError; // error variance

  const varianceBetween = (msr - msw) / cols;
  const varianceRater = (ssCols / dfCols - msw) / rows;
  const varianceError = msw;
  const varianceTotal = varianceBetween + varianceRater + varianceError;
  if (varianceTotal === 0) return { icc: NaN };
  const icc = varianceBetween / varianceTotal;
  return {
    icc,
    nSubjects: rows,
    nRaters: cols,
    msr,
    msError: msw,
  };
}

const KAPPA_DEFAULT_BANDS = [1, 5, 10];

/**
 * Convenience wrapper for two raters across continuous score bands.
 * Produces Cohen's Kappa on discretised bands, plus Fliess-weighted agreement
 * using ±tolerances. Accepts two equal-length numeric vectors.
 */
function interRaterMetrics(raterA, raterB) {
  return {
    n: raterA.length,
    exactAgreement: exactAgreement(raterA, raterB),
    adjacent5: adjacentAgreement(raterA, raterB, 5),
    adjacent10: adjacentAgreement(raterA, raterB, 10),
    pearson: pearson(raterA, raterB),
    spearman: spearman(raterA, raterB),
    cohensKappa: cohensKappa(raterA, raterB),
    weightedKappa: weightedKappa(raterA, raterB),
  };
}

module.exports = {
  mean,
  std,
  pearson,
  spearman,
  rank,
  mae,
  rmse,
  exactAgreement,
  adjacentAgreement,
  interRunVariance,
  computeMetrics: evaluateMetrics,
  cohensKappa,
  weightedKappa,
  iccTwoWay,
  interRaterMetrics,
  calibrationBins,
  expectedCalibrationError,
  brierScore,
  isScoreStable,
  scoreStability,
};