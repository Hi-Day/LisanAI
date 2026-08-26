/**
 * Bounded concurrency (PRD P0-4)
 *
 * Runs a set of independent async tasks with a maximum number of in-flight
 * executions, preserving input order in the resolved results. Never uses
 * unlimited Promise.all (which would fire every task at once).
 *
 * Results are keyed by index so downstream code can always map a result back
 * to its originating item, even when tasks complete out of order.
 */

const DEFAULT_CONCURRENCY = 3;

/**
 * @param {Array<T>} items
 * @param {number} [concurrency=3]  max simultaneous executions (>=1)
 * @param {(item:T, index:number) => Promise<R>} task
 * @returns {Promise<Array<{index:number, value?:R, error?:Error}>>}
 *   One entry per item (in original order). Each is either `{index, value}`
 *   on success or `{index, error}` on failure — failures never reject the
 *   whole batch.
 */
async function mapWithConcurrency(items, concurrency, task) {
  const list = Array.isArray(items) ? items : [];
  const limit = Math.max(1, Math.floor(Number(concurrency) || DEFAULT_CONCURRENCY));
  const results = new Array(list.length);

  let nextIndex = 0;
  async function worker() {
    while (nextIndex < list.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        const value = await task(list[index], index);
        results[index] = { index, value };
      } catch (error) {
        results[index] = { index, error: error instanceof Error ? error : new Error(String(error)) };
      }
    }
  }

  const workerCount = Math.min(limit, Math.max(1, list.length));
  const workers = [];
  for (let i = 0; i < workerCount; i += 1) workers.push(worker());
  await Promise.all(workers);
  return results;
}

module.exports = { mapWithConcurrency, DEFAULT_CONCURRENCY };