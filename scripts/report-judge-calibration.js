const assert = require("node:assert/strict");
const { loadDataset, validateDataset } = require("../server/evaluation/benchmark/dataset");
const { runExperiment } = require("../server/evaluation/benchmark/benchmark");

const datasetName = "lisanai-calibration-v2";
const dataset = loadDataset(datasetName);
const validation = validateDataset(dataset.samples);
const isVercelBuild = process.env.VERCEL === "1";
const hasOpenRouterKey = Boolean(
  process.env.OPENROUTER_API_KEY &&
  process.env.OPENROUTER_API_KEY !== "mock-key" &&
  !process.env.OPENROUTER_API_KEY.includes("your_api_key")
);

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const criterionIdOf = (criterion) => String(
  criterion && (criterion.criterionId || criterion.id || criterion.name) || ""
).trim();
const criterionScoreOf = (criterion) => {
  const score = Number(criterion && criterion.score);
  return Number.isFinite(score) ? score : null;
};

function logCriterionDiagnostics(sample, result) {
  const rubricCriteria = sample.rubric.criteria || [];
  const referenceScores = sample.humanCriterionScores || {};
  const predictedById = new Map((result.criteria || []).map((criterion) => [
    criterionIdOf(criterion),
    criterion,
  ]));
  const expectedIds = rubricCriteria.map((criterion) => String(criterion.id));
  const actualIds = [...predictedById.keys()];
  const missingIds = expectedIds.filter((id) => !predictedById.has(id));
  const unexpectedIds = actualIds.filter((id) => !expectedIds.includes(id));

  console.log(`  Criterion coverage: expected=${expectedIds.length} | returned=${actualIds.length} | missing=${missingIds.length ? missingIds.join(",") : "none"} | unexpected=${unexpectedIds.length ? unexpectedIds.join(",") : "none"}`);

  let weightedReference = 0;
  let weightedPredicted = 0;
  let comparableCriteria = 0;

  for (const rubricCriterion of rubricCriteria) {
    const id = String(rubricCriterion.id);
    const weight = Number(rubricCriterion.weight || 0);
    const reference = Number(referenceScores[id]);
    const predicted = criterionScoreOf(predictedById.get(id));
    const hasReference = Number.isFinite(reference);
    const hasPrediction = Number.isFinite(predicted);
    const referenceContribution = hasReference ? reference * weight : null;
    const predictedContribution = hasPrediction ? predicted * weight : null;
    const delta = hasReference && hasPrediction ? predicted - reference : null;
    const contributionDelta = delta === null ? null : delta * weight;

    if (hasReference) weightedReference += referenceContribution;
    if (hasPrediction) weightedPredicted += predictedContribution;
    if (hasReference && hasPrediction) comparableCriteria += 1;

    const fmt = (value, digits = 1) => value === null ? "N/A" : value.toFixed(digits);
    console.log(
      `    ${id} | weight=${fmt(weight * 100, 0)}% | ref=${fmt(hasReference ? reference : null, 0)} | llm=${fmt(predicted, 0)} | delta=${delta === null ? "N/A" : (delta > 0 ? "+" : "") + fmt(delta, 0)} | weightedRef=${fmt(referenceContribution, 2)} | weightedLLM=${fmt(predictedContribution, 2)} | weightedDelta=${contributionDelta === null ? "N/A" : (contributionDelta > 0 ? "+" : "") + fmt(contributionDelta, 2)}`
    );
  }

  console.log(
    `  Criterion subtotal: reference=${weightedReference.toFixed(2)} | llm=${weightedPredicted.toFixed(2)} | comparable=${comparableCriteria}/${rubricCriteria.length} | note=weighted subtotals can be partial when criteria are missing`
  );
}

async function main() {
  console.log("\n========== LisanAI LLM Judge Calibration ==========");
  console.log(`Dataset: ${datasetName} | samples: ${dataset.samples.length} | version: ${dataset.version || "unspecified"}`);
  console.log(`Schema validation: ${validation.valid ? "PASS" : "FAIL"} | invalid: ${validation.invalidCount || 0}`);
  assert.equal(validation.valid, true, JSON.stringify(validation));
  assert.equal(dataset.samples.length, 12, "Expected 12 calibration cases");

  for (const sample of dataset.samples) {
    assert.ok(Number.isFinite(sample.humanScore), `Missing reference score: ${sample.sampleId}`);
    const weightSum = sample.rubric.criteria.reduce((sum, criterion) => sum + Number(criterion.weight || 0), 0);
    assert.ok(Math.abs(weightSum - 1) < 0.001, `Rubric weights must sum to 1: ${sample.sampleId}`);
  }

  // On Vercel, do not silently report an offline fixture check as a live evaluation.
  if (!hasOpenRouterKey) {
    console.log("Mode: OFFLINE FIXTURE CHECK — OPENROUTER_API_KEY is unavailable.");
    console.log("No model was called; live score deviation was NOT measured.");
    console.log("Reference scores are synthetic and must be lecturer-validated before research claims.");
    if (isVercelBuild) {
      console.error("ERROR: Vercel build requires OPENROUTER_API_KEY to run the requested live LLM Judge evaluation.");
      process.exitCode = 1;
      return;
    }
    console.log("Result: fixture valid; live evaluation skipped for this local build.");
    console.log("===================================================\n");
    return;
  }

  const primaryModel = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
  const fallbackModel = process.env.OPENROUTER_FALLBACK_MODEL || "nvidia/nemotron-3-super-120b-a12b:free";
  console.log("Mode: LIVE LLM EVALUATION");
  console.log("Provider: OpenRouter (OPENROUTER_API_KEY detected; key value is never logged)");
  console.log(`Configured primary model: ${primaryModel}`);
  console.log(`Configured fallback model: ${fallbackModel}`);
  console.log("Evaluation path: production assessment harness (rubric/evidence/judgment/verification)");
  console.log("Reference warning: fixture labels are synthetic, not lecturer-validated ground truth.");

  const experiment = await runExperiment({
    dataset: datasetName,
    mode: "harness",
    providerName: "openrouter",
    repeats: 1,
  });

  const rows = experiment.results || [];
  const byId = new Map(rows.map((row) => [row.sampleId, row]));
  const comparable = dataset.samples.map((sample) => {
    const result = byId.get(sample.sampleId);
    if (!result || !Number.isFinite(result.score)) {
      throw new Error(`Live evaluation did not return a numeric score for ${sample.sampleId}`);
    }
    return {
      sampleId: sample.sampleId,
      reference: sample.humanScore,
      predicted: result.score,
      delta: result.score - sample.humanScore,
      absDelta: Math.abs(result.score - sample.humanScore),
      result,
      sample,
    };
  });

  const mae = mean(comparable.map((row) => row.absDelta));
  const rmse = Math.sqrt(mean(comparable.map((row) => row.delta ** 2)));
  const withinFive = comparable.filter((row) => row.absDelta <= 5).length;

  console.log("\nPer-case live results (positive delta = model over-scored):");
  for (const row of comparable) {
    console.log(
      `  ${row.sampleId} | reference=${String(row.reference).padStart(3)} | llm=${String(row.predicted).padStart(3)} | delta=${String(row.delta).padStart(4)} | absDelta=${String(row.absDelta).padStart(3)}`
    );
  }

  console.log("\n========== PER-CRITERION DIAGNOSTICS ==========");
  console.log("Each weightedDelta is the criterion's contribution to the overall score gap (LLM minus synthetic reference).");
  console.log("Evidence/rationale are not printed to keep build logs compact and avoid leaking student response details.");
  for (const row of comparable) {
    console.log(`\n[${row.sampleId}] overall reference=${row.reference} | llm=${row.predicted} | delta=${row.delta} | case=${row.sample.caseLabel || "unspecified"}`);
    logCriterionDiagnostics(row.sample, row.result);
  }
  console.log("========== END PER-CRITERION DIAGNOSTICS ==========");

  console.log(`Live samples scored: ${comparable.length}/${dataset.samples.length}`);
  console.log(`MAE: ${mae.toFixed(2)} points`);
  console.log(`RMSE: ${rmse.toFixed(2)} points`);
  console.log(`Within ±5 points: ${withinFive}/${comparable.length} (${(100 * withinFive / comparable.length).toFixed(1)}%)`);
  console.log(`Target MAE <= 5: ${mae <= 5 ? "MET" : "NOT MET"} (informational; synthetic labels)`);
  console.log("Interpretation: these metrics are diagnostic only until the reference scores are validated by lecturers.");
  console.log("===================================================\n");
}

main().catch((error) => {
  console.error("LIVE LLM JUDGE CALIBRATION FAILED");
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
