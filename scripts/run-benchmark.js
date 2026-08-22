/**
 * Benchmark experiment runner CLI (PRD §33 PR-07..10, Phase 7).
 *
 * Usage:
 *   node scripts/run-benchmark.js --dataset <name> [--mode baseline|harness|both]
 *                                  [--repeats N] [--provider mock|openrouter]
 *                                  [--out <path>]
 *
 * Runs the experimental pipeline (Baseline vs Harness) over a bundled dataset,
 * computes research metrics, and (optionally) writes a reproducible JSON report.
 */
const path = require("node:path");
const fs = require("node:fs");
const { ROOT } = require("../server/config");
const { runExperiment } = require("../server/evaluation/benchmark/benchmark");

function parseArgs(argv) {
  const args = { mode: "both", repeats: 1, provider: process.env.HARNESS_PROVIDER || "mock" };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[i + 1];
    if (a === "--dataset" && next()) args.dataset = argv[(i += 1)];
    else if (a === "--mode" && next()) args.mode = argv[(i += 1)];
    else if (a === "--repeats" && next()) args.repeats = Number(argv[(i += 1)]);
    else if (a === "--provider" && next()) args.provider = argv[(i += 1)];
    else if (a === "--out" && next()) args.out = argv[(i += 1)];
    else if (a === "--report-dir" && next()) args.reportDir = argv[(i += 1)];
    else if (a === "--help" || a === "-h") args.help = true;
  }
  const modeNormalized = args.mode === "both" ? ["baseline", "harness"] : [args.mode];
  return { ...args, mode: modeNormalized };
}

function usage() {
  return `
  Usage: node scripts/run-benchmark.js [options]

  Options:
    --dataset <name>    Dataset name (default: sample-bench-smoke)
    --mode <mode>       baseline | harness | both (default: baseline)
    --repeats <n>       Repeat each sample n times to measure consistency
    --provider <p>      mock | openrouter (default: mock)
    --out <path>        Write a JSON report to path
    --report-dir <dir>  Write research/ deliverables into <dir> (default: research/)
  `;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.dataset) {
    console.error("Wajib --dataset <name>");
    process.exit(2);
  }
  if (args.repeats && (!Number.isFinite(args.repeats) || args.repeats < 1)) {
    console.error("--repeats harus >= 1");
    process.exit(2);
  }

  console.log(`▶ Benchmark dimulai`);
  console.log(`  dataset : ${args.dataset}`);
  console.log(`  mode    : ${args.mode.join(", ")}`);
  console.log(`  repeats : ${args.repeats || 1}`);
  console.log(`  provider: ${args.provider}`);

  const started = Date.now();
  const experiment = await runExperiment({
    dataset: args.dataset,
    mode: args.mode,
    providerName: args.provider,
    repeats: args.repeats || 1,
  });
  experiment.startedAt = new Date().toISOString();
  experiment.elapsedMs = Date.now() - started;

  console.log("\n=== METRICS ===");
  console.log(JSON.stringify(experiment.metrics, null, 2));
  if (experiment.consistency) {
    console.log("\n=== CONSISTENCY ===");
    console.log(JSON.stringify(experiment.consistency, null, 2));
  }

  if (args.out) {
    const outPath = path.isAbsolute(args.out) ? args.out : path.join(ROOT, args.out);
    const report = {
      kind: "lisanai-benchmark",
      generatedAt: experiment.startedAt,
      elapsedMs: experiment.elapsedMs,
      dataset: experiment.datasetName,
      datasetVersion: experiment.datasetVersion,
      mode: experiment.mode,
      repeats: experiment.repeats,
      provider: args.provider,
      validation: experiment.validation,
      metrics: experiment.metrics,
      consistency: experiment.consistency,
      pairs: experiment.pairs,
    };
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`\nLaporan tersimpan: ${outPath}`);
  } else {
    console.log("\nGunakan --out <path> untuk menyimpan laporan reproducible.");
  }

  // PRD §47 — research/ deliverables (dataset→baseline→harness→metrics→report).
  if (args.reportDir) {
    const base = path.isAbsolute(args.reportDir) ? args.reportDir : path.join(ROOT, args.reportDir);
    const mkp = (...p) => {
      const d = path.join(base, ...p);
      fs.mkdirSync(d, { recursive: true });
      return d;
    };
    const writeJsonl = (rows, file) => {
      const body = (rows || []).map((r) => JSON.stringify(r)).join("\n") + "\n";
      fs.writeFileSync(path.join(mkp("."), file), body, "utf8");
    };
    writeJsonl(
      experiment.results.filter((r) => r.evaluationMode === "baseline"),
      "baseline.jsonl"
    );
    writeJsonl(
      experiment.results.filter((r) => r.evaluationMode === "harness"),
      "harness.jsonl"
    );
    fs.writeFileSync(
      path.join(mkp("metrics"), "results.json"),
      JSON.stringify(experiment.metrics, null, 2),
      "utf8"
    );
    const reportPath = path.join(mkp("report"), "experiment-report.md");
    fs.writeFileSync(reportPath, buildResearchReport(experiment), "utf8");
    console.log(`\nDeliverables riset tersimpan di: ${base}`);
    console.log(`  baseline.jsonl, harness.jsonl, metrics/results.json, report/experiment-report.md`);
  }
}

/**
 * Render a human-readable experiment report (PRD §47).
 */
function buildResearchReport(exp) {
  const m = exp.metrics || {};
  const lines = [];
  lines.push("# LisanAI Research Experiment Report");
  lines.push("");
  lines.push(`- **Dataset:** \`${path.basename(exp.datasetName)}\` (${exp.datasetVersion})`);
  lines.push(`- **Mode:** ${(exp.mode || []).join(", ")}`);
  lines.push(`- **Repeats:** ${exp.repeats}`);
  lines.push(`- **Provider:** ${exp.provider || "mock"}`);
  lines.push(`- **Generated:** ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Human Agreement (AI vs human)");
  lines.push("");
  lines.push("| Mode | n | Pearson | Spearman | MAE | RMSE | Exact | ±5 | ±10 |");
  lines.push("|---|---|---|---|---|---|---|---|---|");
  const ag = m.agreement || {};
  for (const mode of ["baseline", "harness"]) {
    const a = ag[mode];
    if (!a) continue;
    const f = (v) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(3) : "—");
    lines.push(
      `| ${mode} | ${a.n} | ${f(a.pearson)} | ${f(a.spearman)} | ${f(a.mae)} | ${f(a.rmse)} | ${f(a.exactAgreement)} | ${f(a.plus5)} | ${f(a.plus10)} |`
    );
  }
  lines.push("");
  lines.push("## Grounding & Compliance");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify({ grounding: m.grounding, compliance: m.compliance }, null, 2));
  lines.push("```");
  if (m.interRater) {
    lines.push("");
    lines.push("## Inter-Rater Reliability (FR-20)");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(m.interRater, null, 2));
    lines.push("```");
  }
  lines.push("");
  lines.push("> Catatan ilmiah: perbandingan harus melalui uji statistik berpasangan + effect size; mean difference saja belum cukup (PRD §35).");
  lines.push("");
  return lines.join("\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});