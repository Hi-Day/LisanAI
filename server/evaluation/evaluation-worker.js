const { initDatabase } = require("../database");
const { startEvaluationWorker } = require("./evaluation-job-service");

async function main() {
  await initDatabase();
  const intervalMs = Number(process.env.EVALUATION_WORKER_INTERVAL_MS || 250);
  startEvaluationWorker({ intervalMs });
  console.log(`[evaluation-worker] started (interval=${intervalMs}ms)`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error("[evaluation-worker] failed to start", error);
    process.exit(1);
  });
}

module.exports = { main };
