const crypto = require("node:crypto");

/**
 * Append-only evaluation trace.
 *
 * Reconstructible: what happened, why, which model, which prompt,
 * which rubric, which harness, which evidence, which score.
 */
class Trace {
  constructor(runId, meta = {}) {
    this.runId = runId || Trace.createRunId();
    this.startedAt = new Date().toISOString();
    this.events = [];
    this.context = {}; // accumulated pipeline state (non-sensitive)
    this.meta = meta;
  }

  static createRunId() {
    return `run_${crypto.randomBytes(6).toString("hex")}`;
  }

  event(type, data = {}) {
    const entry = {
      type,
      ts: new Date().toISOString(),
      ...data,
    };
    this.events.push(entry);
    return entry;
  }

  setContext(key, value) {
    this.context[key] = value;
  }

  getContext(key) {
    return this.context[key];
  }

  /**
   * Capture a full reconstruction snapshot for the run.
   */
  snapshot(parts = {}) {
    return {
      runId: this.runId,
      startedAt: this.startedAt,
      events: this.events,
      ...parts, // model, promptVersion, rubricVersion, harnessVersion, etc.
    };
  }
}

module.exports = { Trace };