const { loadDataset, validateDataset } = require("./dataset");
const { createHarness } = require("../../harness");
const { MockProvider } = require("../../ai/mock-provider");
const { OpenRouterProvider } = require("../../ai/openrouter-provider");
const { parse } = require("../../ai/response-parser");
const { summarizeExperimentMetrics } = require("./experiment-metrics");

/**
 * Deterministic single-prompt baseline provider — returns { score } (0-100).
 * Intended for the baseline mode where the model yields a whole-answer score
 * WITHOUT rubric/evidence/verification (PR-08).
 */
class BaselineMockProvider extends MockProvider {
  constructor() {
    super();
    this.name = "mock-baseline";
  }

  async generate(request) {
    const { prompt } = request;
    let studentAnswer = "";
    let hint = 0;
    try {
      const p = JSON.parse(prompt);
      studentAnswer = String(
        (Array.isArray(p.studentAnswer) ? p.studentAnswer : [p.studentAnswer]).join(" ")
      );
    } catch { /* ignore */ }
    return JSON.stringify({ score: MockProvider.hashScore(studentAnswer, hint) });
  }
}

/**
 * PRD §24 Experimental Pipeline — Baseline vs Harness evaluation runner.
 *
 * Independent variable: evaluation architecture (baseline | harness).
 * Controlled: model, temperature, question, rubric, student answer, schema,
 * dataset. Both runners accept the SAME dataset sample.
 */

/**
 * Pick a provider by name (defaults to mock unless OPENROUTER key present).
 * [PRD §9, §27: provider + feature flag decoupling.]
 */
function resolveProvider(name) {
  const chosen = name || process.env.HARNESS_PROVIDER || "mock";
  if (chosen === "openrouter") return new OpenRouterProvider();
  return new MockProvider();
}

/**
 * Baseline provider for the single-prompt mode. OpenRouter is reused for the
 * real experiment; mock is deterministic for tests.
 */
function resolveBaselineProvider(name) {
  const chosen = name || process.env.HARNESS_PROVIDER || "mock";
  if (chosen === "openrouter") return new OpenRouterProvider();
  return new BaselineMockProvider();
}

/**
 * PR-09 — Harness evaluation runner. Runs a single dataset sample through
 * the full assessment harness (rubric → evidence → criterion judgment →
 * verification → deterministic scoring → reliability).
 * @returns { { score, evaluationMode, sampleId, question, rubric, studentAnswers, humanScore, verification, reliability, criteria, versioning } }
 */
async function runSampleHarness(harness, sample, opts = {}) {
  const sid = sample.sampleId || "sample";
  const result = await harness.evaluate({
    assessmentId: opts.assessmentId || `bench-${sid}`,
    assessment: {
      id: opts.assessmentId || `bench-${sid}`,
      topic: sample.question ? String(sample.question).slice(0, 60) : null,
    },
    rubric: sample.rubric,
    answers: Array.isArray(sample.studentAnswers) ? sample.studentAnswers : [sample.studentAnswers],
    tenantId: opts.tenantId || "bench",
    userId: opts.userId || "bench",
  });
  return {
    sampleId: sid,
    question: sample.question,
    studentAnswer: sample.studentAnswers,
    humanScore: sample.humanScore,
    score: Math.round(clamp(result.finalScore, 0, 100)),
    evaluationMode: "harness",
    verification: result.verification,
    reliability: result.reliability,
  };
}

/**
 * PR #8 — Baseline evaluation runner.
 *
 * A single-prompt LLM that returns a numeric score for the whole answer,
 * WITHOUT rubric/evidence/verification. Uses the same provider/parser so the
 * ONLY difference vs harness is the architecture (independent variable).
 * @returns { { score, evaluationMode, humanScore, raw } }
 */
async function runSampleBaseline(provider, parser, sample, opts = {}) {
  const rubricSummary = (sample.rubric.criteria || [])
    .map((c) => `${c.name || c.id} (bobot ${c.weight})`)
    .join(", ");
  const prompt = JSON.stringify({
    task: "Beri skor 0-100 pada jawaban mahasiswa berikut berdasarkan rubrik.",
    question: sample.question,
    rubric: rubricSummary,
    studentAnswer: (Array.isArray(sample.studentAnswers) ? sample.studentAnswers : [sample.studentAnswers]).join("\n"),
    instructions: "Balas hanya JSON: {\"score\": 0-100}. Tidak ada penjelasan.",
  });
  const rawContent = await provider.generate({
    prompt,
    tenantId: opts.tenantId,
    userId: opts.userId,
    schemaHint: 'Balas JSON: {"score":0-100}.',
  });
  const parsed = await parser.parse(rawContent);
  // Baseline providers must return a numeric score. Handle {score},
  // {finalScore}, and a harness-shaped {criteria} fallback (mean of criteria).
  let score = null;
  if (parsed && typeof parsed.score === "number") score = parsed.score;
  else if (parsed && typeof parsed.finalScore === "number") score = parsed.finalScore;
  else if (parsed && Array.isArray(parsed.criteria) && parsed.criteria.length) {
    const scores = parsed.criteria.map((c) => Number(c.score)).filter((n) => Number.isFinite(n));
    if (scores.length) score = scores.reduce((a, b) => a + b, 0) / scores.length;
  }
  return {
    sampleId: sample.sampleId,
    question: sample.question,
    studentAnswer: sample.studentAnswers,
    humanScore: sample.humanScore,
    score: score && Number.isFinite(score) ? Math.round(clamp(score, 0, 100)) : null,
    raw: parsed,
    evaluationMode: "baseline",
  };
}

/**
 * Run a full experiment over a dataset for one or more modes.
 * [PRD §24 Experimental Pipeline]
 * @returns {Promise<object>}
 */
async function runExperiment({ dataset, mode, harnessConfig, providerName, assessmentIdPrefix }) {
  const loaded = loadDataset(dataset);
  const validation = validateDataset(loaded.samples);
  const modes = (Array.isArray(mode) ? mode : [mode || "baseline"]).filter(Boolean);
  if (modes.length === 0) modes.push("baseline");

  const results = [];
  for (const m of modes) {
    if (m === "harness") {
      const harnessInst = createHarness(harnessConfig || {});
      harnessInst.setProvider(resolveProvider(providerName)).setParser({ parse });
      for (const sample of loaded.samples) {
        // eslint-disable-next-line no-await-in-loop
        results.push(
          await runSampleHarness(harnessInst, sample, {
            assessmentId: `${assessmentIdPrefix || "bench"}-${m}-${sample.sampleId || "s"}`,
          })
        );
      }
    } else if (m === "baseline") {
      const provider = resolveBaselineProvider(providerName);
      for (const sample of loaded.samples) {
        // eslint-disable-next-line no-await-in-loop
        results.push(await runSampleBaseline(provider, { parse }, sample));
      }
    } else {
      throw new Error(`Mode tidak dikenal: ${m} (harapkan 'baseline' atau 'harness')`);
    }
  }

  // Pair baseline vs harness for human agreement when both modes ran.
  let pairs = null;
  if (new Set(modes).size > 1) {
    const baselineBy = keyBy(results.filter((r) => r.evaluationMode === "baseline"));
    const harnessBy = keyBy(results.filter((r) => r.evaluationMode === "harness"));
    pairs = Object.keys(harnessBy).map((sid) => ({
      sampleId: sid,
      baselineScore: baselineBy[sid] ? baselineBy[sid].score : null,
      harnessScore: harnessBy[sid] ? harnessBy[sid].score : null,
      humanScore: harnessBy[sid] ? harnessBy[sid].humanScore : null,
    }));
  }

  return {
    datasetName: loaded.file,
    datasetVersion: loaded.version,
    validation,
    mode: modes,
    results,
    pairs,
    metrics: summarizeExperimentMetrics({ results }),
  };
}

function keyBy(rows) {
  const map = {};
  for (const r of rows) {
    if (r.sampleId) map[r.sampleId] = r;
  }
  return map;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

module.exports = {
  runSampleHarness,
  runSampleBaseline,
  runExperiment,
  resolveProvider,
  resolveBaselineProvider,
  BaselineMockProvider,
  clamp,
};