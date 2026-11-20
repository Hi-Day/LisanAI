import { escapeHtml } from "./utils.js";

/**
 * Tables inside a question.
 *
 * A question's prompt stays one plain string. A table is written in it as a
 * Markdown pipe table (what a language model produces by itself and what a
 * lecturer can type):
 *
 *   | Bulan | Penjualan |
 *   | --- | --- |
 *   | Januari | 120 |
 *
 * Nothing in the prompt is ever treated as HTML: every cell is escaped.
 */

const TABLE_LINE = /^\s*\|.*\|\s*$/;
const SEPARATOR_LINE = /^\s*\|(\s*:?-{2,}:?\s*\|)+\s*$/;
export const TABLE_TEMPLATE = "| Kolom 1 | Kolom 2 | Kolom 3 |\n| --- | --- | --- |\n| ... | ... | ... |\n| ... | ... | ... |";

function cells(line) {
  // "\|" is a literal bar inside a cell.
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

/** Split a prompt into its sentences (`prose`) and its tables. Two or more consecutive pipe lines form a table. */
export function splitQuestionText(text) {
  const prose = [];
  const tables = [];
  let block = [];
  const flush = () => {
    if (block.length >= 2) {
      const [header, ...rest] = block;
      tables.push({ header: cells(header), rows: rest.filter((line) => !SEPARATOR_LINE.test(line)).map(cells) });
    } else {
      prose.push(...block);
    }
    block = [];
  };
  for (const line of String(text ?? "").split(/\r?\n/)) {
    if (TABLE_LINE.test(line)) block.push(line);
    else { flush(); prose.push(line); }
  }
  flush();
  return { prose: prose.join("\n").replace(/\n{3,}/g, "\n\n").trim(), tables };
}

/** The prompt without its tables: for headings, one-line summaries and truncated lists. */
export function questionProse(text) {
  return splitQuestionText(text).prose;
}

/** Safe HTML for the tables of a prompt ("" when it has none). Each table scrolls sideways inside its own container. */
export function questionTablesHtml(text) {
  return splitQuestionText(text).tables.map(({ header, rows }) => {
    const width = Math.max(header.length, ...rows.map((row) => row.length));
    const pad = (row) => Array.from({ length: width }, (_, i) => row[i] ?? "");
    return `<div class="table-container question-table"><table class="data-table"><thead><tr>${pad(header).map((cell) => `<th scope="col">${escapeHtml(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${pad(row).map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }).join("");
}
