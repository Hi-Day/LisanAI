const assert = require("node:assert/strict");
const test = require("node:test");

const { isMultiPartPrompt, stripToSingleSubstance } = require("../server/assessment/question-repair");
const { keepTable, withoutTables } = require("../server/assessment/question-table");
const { buildMessages } = require("../server/assessment/question-generation");

const TABLE = "| Bulan | Penjualan |\n| --- | --- |\n| 1. Januari | 120 |\n| 2. Februari | 95 |";
const PROMPT = `Perhatikan data penjualan berikut.\n\n${TABLE}\n\nJelaskan mengapa penjualan menurun.`;

test("a question table renders as an escaped HTML table and leaves the wording as prose", async () => {
  const { splitQuestionText, questionTablesHtml, questionProse } = await import("../src/js/question-text.js");
  const { prose, tables } = splitQuestionText(PROMPT);
  assert.equal(prose, "Perhatikan data penjualan berikut.\n\nJelaskan mengapa penjualan menurun.");
  assert.deepEqual(tables, [{ header: ["Bulan", "Penjualan"], rows: [["1. Januari", "120"], ["2. Februari", "95"]] }]);
  assert.equal(questionProse(PROMPT), prose);

  const html = questionTablesHtml("| A | <img src=x onerror=alert(1)> |\n| --- | --- |\n| a \\| b |");
  assert.ok(html.includes("<th scope=\"col\">A</th>"));
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"), "cell content is escaped, never HTML");
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("<td>a | b</td><td></td>"), "escaped bar stays in the cell and short rows are padded");
});

test("text without a table, or a single line with bars, is left alone", async () => {
  const { splitQuestionText, questionTablesHtml } = await import("../src/js/question-text.js");
  assert.equal(questionTablesHtml("Jelaskan konsep |x| pada bilangan real."), "");
  assert.deepEqual(splitQuestionText("| hanya satu baris |"), { prose: "| hanya satu baris |", tables: [] });
  assert.deepEqual(splitQuestionText(null), { prose: "", tables: [] });
});

test("table rows do not make a single-task question look multi-part", () => {
  assert.equal(isMultiPartPrompt(PROMPT), false);
  assert.equal(withoutTables(PROMPT), "Perhatikan data penjualan berikut.\n\nJelaskan mengapa penjualan menurun.");
  assert.equal(isMultiPartPrompt(`${TABLE}\nJelaskan tren penjualan dan sebutkan penyebabnya.`), true, "the wording is still checked");
});

test("rewriting a question never loses its table", () => {
  const multi = `Jelaskan tren penjualan. Kemudian sebutkan tiga penyebabnya.\n\n${TABLE}`;
  const stripped = stripToSingleSubstance(multi);
  assert.equal(isMultiPartPrompt(stripped), false);
  assert.ok(stripped.endsWith(TABLE));
  assert.equal(keepTable(PROMPT, "Mengapa penjualan menurun?"), `Mengapa penjualan menurun?\n\n${TABLE}`);
  assert.equal(keepTable(PROMPT, `Soal baru.\n${TABLE}`), `Soal baru.\n${TABLE}`, "a rewrite that kept a table is not doubled");
  assert.equal(keepTable("Tanpa tabel.", "Tetap tanpa tabel."), "Tetap tanpa tabel.");
});

test("question generation tells the model how to write a table", () => {
  const [message] = buildMessages({ topic: "Statistika", count: 2, outcomes: "LO1: Siswa mampu menafsirkan data.", rubric: "Ketepatan 60%\nPenalaran 40%", difficulty: "Menengah" });
  const body = JSON.parse(message.content);
  assert.match(body.aturan_tabel_pada_soal, /tabel Markdown/);
  assert.match(body.aturan_tabel_pada_soal, /JANGAN membuat tabel bila soal tidak membutuhkan data/);
});
