/**
 * A question prompt may carry a Markdown pipe table (data the student analyses).
 * The table is data, not part of the task wording: wording checks ignore it and
 * rewrites of the wording must not lose it.
 */

const TABLE_LINE = /^\s*\|.*\|\s*$/;

function splitPrompt(prompt) {
  const lines = String(prompt || "").split(/\r?\n/);
  return {
    prose: lines.filter((line) => !TABLE_LINE.test(line)).join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    table: lines.filter((line) => TABLE_LINE.test(line)).join("\n"),
  };
}

/** The wording of a prompt, without table rows. */
function withoutTables(prompt) {
  return splitPrompt(prompt).prose;
}

/** `rewritten` with the original's table put back when the rewrite dropped it. */
function keepTable(original, rewritten) {
  const text = String(rewritten || "").trim();
  const { table } = splitPrompt(original);
  if (!table || splitPrompt(text).table) return text;
  return `${text}\n\n${table}`;
}

module.exports = { withoutTables, keepTable };
