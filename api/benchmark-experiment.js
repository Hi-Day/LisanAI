const fs = require("node:fs");
const path = require("node:path");
const { ensureDatabase } = require("../server/bootstrap");
const { sendJson, readJson } = require("../server/http-utils");
const { requireAuthenticatedRequest, requireRoles } = require("../server/http/request-security");
const { DATASET_DIR } = require("../server/evaluation/benchmark/dataset");
const { runExperiment } = require("../server/evaluation/benchmark/benchmark");

const MAX_SAMPLES = 20;
const MAX_REPEATS = 3;

function validateBenchmarkRequest(payload = {}) {
  const dataset = String(payload.dataset || "").trim();
  const mode = String(payload.mode || "both");
  const provider = String(payload.provider || "mock");
  const sampleLimit = Number(payload.sampleLimit ?? 10);
  const repeats = Number(payload.repeats ?? 1);

  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(dataset)) {
    return { valid: false, error: "Dataset tidak valid" };
  }
  if (!["baseline", "harness", "both"].includes(mode)) {
    return { valid: false, error: "Mode harus baseline, harness, atau both" };
  }
  if (!["mock", "openrouter"].includes(provider)) {
    return { valid: false, error: "Provider harus mock atau openrouter" };
  }
  if (!Number.isInteger(sampleLimit) || sampleLimit < 1 || sampleLimit > MAX_SAMPLES) {
    return { valid: false, error: `Jumlah sampel harus 1–${MAX_SAMPLES}` };
  }
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > MAX_REPEATS) {
    return { valid: false, error: `Repeated runs harus 1–${MAX_REPEATS}` };
  }
  const methodCount = mode === "both" ? 2 : 1;
  if (sampleLimit * repeats * methodCount > 30) {
    return { valid: false, error: "Konfigurasi melebihi 30 evaluasi model per eksperimen; kurangi sampel/repeats atau pilih satu metode" };
  }
  return { valid: true, dataset, mode, provider, sampleLimit, repeats };
}

function listDatasets() {
  if (!fs.existsSync(DATASET_DIR)) return [];
  return fs.readdirSync(DATASET_DIR)
    .filter((file) => file.endsWith(".json") && /^[a-zA-Z0-9_-]+\.json$/.test(file))
    .map((file) => {
      const name = path.basename(file, ".json");
      try {
        const data = JSON.parse(fs.readFileSync(path.join(DATASET_DIR, file), "utf8"));
        const samples = Array.isArray(data) ? data : data.samples;
        return {
          id: name,
          name: data.metadata?.name || name,
          version: data.version || "v1",
          sampleCount: Array.isArray(samples) ? samples.length : 0,
        };
      } catch {
        return null;
      }
    })
    .filter((item) => item && item.sampleCount > 0);
}

module.exports = async (req, res) => {
  try {
    await ensureDatabase();
    const security = await requireAuthenticatedRequest(req, res, {
      allowApiKey: false,
      csrf: req.method !== "GET",
      rateLimit: "research-benchmark",
      rateLimitOptions: { limit: 5, windowMs: 60_000 },
    });
    if (!security) return;
    if (!requireRoles(res, security.auth, ["admin"])) return;

    if (req.method === "GET") {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.searchParams.get("action") !== "datasets") {
        return sendJson(res, 404, { error: "Action not found" });
      }
      return sendJson(res, 200, {
        datasets: listDatasets(),
        configuredModel: process.env.OPENROUTER_MODEL || "model sesuai konfigurasi server",
        maxSamples: MAX_SAMPLES,
        maxRepeats: MAX_REPEATS,
      });
    }

    if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" });
    const body = await readJson(req);
    if (body.action !== "run") return sendJson(res, 404, { error: "Action not found" });
    const config = validateBenchmarkRequest(body.payload);
    if (!config.valid) return sendJson(res, 400, { error: config.error });

    const dataset = listDatasets().find((item) => item.id === config.dataset);
    if (!dataset) return sendJson(res, 400, { error: "Dataset tidak tersedia" });
    if (config.provider === "openrouter" && !process.env.OPENROUTER_API_KEY) {
      return sendJson(res, 400, { error: "OPENROUTER_API_KEY belum dikonfigurasi di server" });
    }

    const startedAt = new Date().toISOString();
    const started = Date.now();
    const experiment = await runExperiment({
      dataset: config.dataset,
      mode: config.mode === "both" ? ["baseline", "harness"] : [config.mode],
      providerName: config.provider,
      repeats: config.repeats,
      sampleLimit: Math.min(config.sampleLimit, dataset.sampleCount),
    });
    const modes = config.mode === "both" ? ["baseline", "harness"] : [config.mode];
    return sendJson(res, 200, {
      experiment: {
        startedAt,
        elapsedMs: Date.now() - started,
        dataset: dataset.id,
        datasetName: dataset.name,
        datasetVersion: experiment.datasetVersion,
        provider: config.provider,
        configuredModel: config.provider === "openrouter"
          ? (process.env.OPENROUTER_MODEL || "default OpenRouter model")
          : "Deterministic mock",
        mode: modes,
        repeats: config.repeats,
        sampleCount: new Set(experiment.results.map((row) => row.sampleId)).size,
        validation: experiment.validation,
        metrics: experiment.metrics,
        comparison: experiment.comparison,
        // Deliberately omit answer text, raw model responses, and per-sample rows.
      },
    });
  } catch (error) {
    console.error("Research benchmark failed:", error);
    return sendJson(res, error.status || 500, { error: error.message || "Benchmark gagal dijalankan" });
  }
};

module.exports.validateBenchmarkRequest = validateBenchmarkRequest;
module.exports.listDatasets = listDatasets;
