const { loadDataset, validateDataset } = require("./dataset");
const { createHarness } = require("../../harness");
const { MockProvider } = require("../../ai/mock-provider");
const { OpenRouterProvider } = require("../../ai/openrouter-provider");
const { parse } = require("../../ai/response-parser");
const { summarizeExperimentMetrics } = require("./experiment-metrics");
const { getCondition, getConditions, buildHarnessConfig } = require("./ablation");

class BaselineMockProvider extends MockProvider {
  constructor() { super(); this.name = "mock-baseline"; }
  async generate(request) {
    const { prompt } = request;
    let studentAnswer = "";
    try {
      const p = JSON.parse(prompt);
      studentAnswer = String((Array.isArray(p.studentAnswer) ? p.studentAnswer : [p.studentAnswer]).join(" "));
    } catch { /* ignore */ }
    return JSON.stringify({ score: MockProvider.hashScore(studentAnswer, 0) });
  }
}

function resolveProvider(name) {
  const chosen = name || process.env.HARNESS_PROVIDER || "mock";
  if (chosen === "openrouter") return new OpenRouterProvider();
  return new MockProvider();
}

function resolveBaselineProvider(name) {
  const chosen = name || process.env.HARNESS_PROVIDER || "mock";
  if (chosen === "openrouter") return new OpenRouterProvider();
  return new BaselineMockProvider();
}

async function runSampleHarness(harness, sample, opts = {}) {
  const sid = sample.sampleId || "sample";
  const result = await harness.evaluate({
    assessmentId: opts.assessmentId || `bench-${sid}`,
    assessment: { id: opts.assessmentId || `bench-${sid}`, topic: sample.question ? String(sample.question).slice(0, 60) : null },
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
    evaluationMode: opts.evaluationMode || "harness",
    verification: result.verification,
    reliability: result.reliability,
    criteria: result.criteria || [],
  };
}

async function runSampleBaseline(provider, parser, sample, opts = {}) {
  const rubricSummary = (sample.rubric.criteria || []).map((c) => `${c.name || c.id} (bobot ${c.weight})`).join(", ");
  const prompt = JSON.stringify({
    task: "Beri skor 0-100 pada jawaban mahasiswa berikut berdasarkan rubrik.",
    question: sample.question,
    rubric: rubricSummary,
    studentAnswer: (Array.isArray(sample.studentAnswers) ? sample.studentAnswers : [sample.studentAnswers]).join("\n"),
    instructions: "Balas hanya JSON: {\"score\": 0-100}. Tidak ada penjelasan.",
  });
  const rawContent = await provider.generate({ prompt, tenantId: opts.tenantId, userId: opts.userId, schemaHint: 'Balas JSON: {"score":0-100}.' });
  const parsed = await parser.parse(rawContent);
  let score = null;
  if (parsed && typeof parsed.score === "number") score = parsed.score;
  else if (parsed && typeof parsed.finalScore === "number") score = parsed.finalScore;
  else if (parsed && Array.isArray(parsed.criteria) && parsed.criteria.length) {
    const scores = parsed.criteria.map((c) => Number(c.score)).filter((n) => Number.isFinite(n));
    if (scores.length) score = scores.reduce((a, b) => a + b, 0) / scores.length;
  }
  return { sampleId: sample.sampleId, question: sample.question, studentAnswer: sample.studentAnswers, humanScore: sample.humanScore, score: score !== null && Number.isFinite(score) ? Math.round(clamp(score, 0, 100)) : null, raw: parsed, evaluationMode: "baseline" };
}

async function runAblationCondition({ dataset, condition, harnessConfig = {}, providerName, assessmentIdPrefix, repeats = 1 }) {
  const loaded = loadDataset(dataset);
  const validation = validateDataset(loaded.samples);
  const selected = getCondition(condition);
  const results = [];
  const perRun = {};
  const mode = selected.id;
  perRun[mode] = {};

  for (let rep = 0; rep < repeats; rep += 1) {
    if (selected.id === "baseline") {
      const provider = resolveBaselineProvider(providerName);
      for (const sample of loaded.samples) {
        const r = await runSampleBaseline(provider, { parse }, sample);
        r.ablationCondition = selected.id;
        results.push(r);
        (perRun[mode][sample.sampleId] ||= []).push(r.score);
      }
    } else {
      const harnessInst = createHarness({ ...buildHarnessConfig(selected.id), ...harnessConfig });
      harnessInst.setProvider(resolveProvider(providerName)).setParser({ parse });
      for (const sample of loaded.samples) {
        const r = await runSampleHarness(harnessInst, sample, {
          assessmentId: `${assessmentIdPrefix || "bench"}-${mode}-${sample.sampleId || "s"}-${rep}`,
          evaluationMode: mode,
        });
        r.ablationCondition = selected.id;
        results.push(r);
        (perRun[mode][sample.sampleId] ||= []).push(r.score);
      }
    }
  }

  const metrics = summarizeExperimentMetrics({ results });
  const consistency = repeats > 1 ? buildConsistency(perRun, repeats) : null;
  return { condition: selected, datasetName: loaded.file, datasetVersion: loaded.version, validation, repeats, results, metrics, consistency };
}

async function runAblationExperiment({ dataset, conditions, harnessConfig, providerName, assessmentIdPrefix, repeats = 1 }) {
  const selected = getConditions(conditions);
  const runs = [];
  for (const condition of selected) {
    // eslint-disable-next-line no-await-in-loop
    runs.push(await runAblationCondition({ dataset, condition: condition.id, harnessConfig, providerName, assessmentIdPrefix, repeats }));
  }

  const summary = {};
  for (const run of runs) {
    summary[run.condition.id] = {
      label: run.condition.label,
      metrics: run.metrics,
      consistency: run.consistency,
    };
  }
  return { datasetName: runs[0]?.datasetName || null, datasetVersion: runs[0]?.datasetVersion || null, conditions: runs.map((r) => r.condition.id), runs, summary };
}

async function runExperiment({ dataset, mode, harnessConfig, providerName, assessmentIdPrefix, repeats = 1, raterMap }) {
  const loaded = loadDataset(dataset);
  const validation = validateDataset(loaded.samples);
  const modes = (Array.isArray(mode) ? mode : [mode || "baseline"]).filter(Boolean);
  if (modes.length === 0) modes.push("baseline");
  const results = [];
  const perRun = {};
  const resolvedRaterMap = raterMap || buildRaterMap(loaded.samples);

  for (const m of modes) {
    perRun[m] = {};
    for (let rep = 0; rep < repeats; rep += 1) {
      if (m === "harness") {
        const harnessInst = createHarness(harnessConfig || {});
        harnessInst.setProvider(resolveProvider(providerName)).setParser({ parse });
        for (const sample of loaded.samples) {
          const r = await runSampleHarness(harnessInst, sample, { assessmentId: `${assessmentIdPrefix || "bench"}-${m}-${sample.sampleId || "s"}-${rep}` });
          results.push(r); (perRun[m][sample.sampleId] ||= []).push(r.score);
        }
      } else if (m === "baseline") {
        const provider = resolveBaselineProvider(providerName);
        for (const sample of loaded.samples) {
          const r = await runSampleBaseline(provider, { parse }, sample);
          results.push(r); (perRun[m][sample.sampleId] ||= []).push(r.score);
        }
      } else throw new Error(`Mode tidak dikenal: ${m} (harapkan 'baseline' atau 'harness')`);
    }
  }

  let pairs = null;
  if (new Set(modes).size > 1) {
    const baselineBy = keyBy(results.filter((r) => r.evaluationMode === "baseline"));
    const harnessBy = keyBy(results.filter((r) => r.evaluationMode === "harness"));
    pairs = Object.keys(harnessBy).map((sid) => ({ sampleId: sid, baselineScore: baselineBy[sid]?.score ?? null, harnessScore: harnessBy[sid]?.score ?? null, humanScore: harnessBy[sid]?.humanScore ?? null }));
  }
  return { datasetName: loaded.file, datasetVersion: loaded.version, validation, mode: modes, repeats, results, pairs, metrics: summarizeExperimentMetrics({ results, raterMap: resolvedRaterMap }), raterMap: resolvedRaterMap && Object.keys(resolvedRaterMap).length >= 2 ? resolvedRaterMap : null, consistency: buildConsistency(perRun, repeats) };
}

function buildRaterMap(samples) {
  const map = {}; let any = false;
  for (const sample of samples || []) {
    if (sample?.humanCriterionScores?.raterScores && typeof sample.humanCriterionScores.raterScores === "object") {
      for (const [raterId, value] of Object.entries(sample.humanCriterionScores.raterScores)) {
        const score = typeof value === "number" ? value : value && typeof value.score === "number" ? value.score : null;
        if (score !== null) { (map[raterId] ||= []).push(score); any = true; }
      }
    } else if (sample?.raterId != null && typeof sample.humanScore === "number") {
      (map[sample.raterId] ||= []).push(sample.humanScore); any = true;
    }
  }
  return any ? map : null;
}

function buildConsistency(perRun, repeats) {
  if (repeats < 2) return null;
  const { consistencyMetrics } = require("./experiment-metrics");
  const out = {};
  for (const [mode, bySample] of Object.entries(perRun)) out[mode] = consistencyMetrics(Object.values(bySample));
  return out;
}

function keyBy(rows) { const map = {}; for (const r of rows) if (r.sampleId) map[r.sampleId] = r; return map; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

module.exports = { runSampleHarness, runSampleBaseline, runExperiment, runAblationCondition, runAblationExperiment, resolveProvider, resolveBaselineProvider, BaselineMockProvider, buildRaterMap, clamp };
