const assert = require("node:assert/strict");
const test = require("node:test");

const { annotateAnswerIndex } = require("../server/harness/harness-evaluator");

test("annotateAnswerIndex maps a slugified criterionId to a display-name question", () => {
  const out = annotateAnswerIndex(
    [{ criterionId: "kosa_kata", score: 80 }],
    [{ criteria: ["Kosa kata"] }, { criteria: ["Grammar"] }],
  );
  assert.equal(out[0].answerIndex, 0);
});

test("annotateAnswerIndex preserves an existing integer answerIndex", () => {
  const out = annotateAnswerIndex(
    [{ criterionId: "kosa_kata", score: 80, answerIndex: 2 }],
    [{ criteria: ["Kosa kata"] }],
  );
  assert.equal(out[0].answerIndex, 2);
});

test("annotateAnswerIndex leaves a criterion unchanged when multiple questions match", () => {
  const out = annotateAnswerIndex(
    [{ criterionId: "grammar", score: 70 }],
    [{ criteria: ["Grammar"] }, { criteria: ["Grammar"] }],
  );
  assert.equal(out[0].answerIndex, undefined);
  assert.equal("answerIndex" in out[0], false);
});

test("annotateAnswerIndex leaves a criterion unchanged when no question matches", () => {
  const out = annotateAnswerIndex(
    [{ criterionId: "fluency", score: 60 }],
    [{ criteria: ["Kosa kata"] }, { criteria: ["Grammar"] }],
  );
  assert.equal("answerIndex" in out[0], false);
});

test("annotateAnswerIndex tolerates questions with empty or missing criteria", () => {
  const out = annotateAnswerIndex(
    [{ criterionId: "kosa_kata", score: 80 }],
    [{}, { criteria: [] }, { criteria: ["Kosa kata"] }],
  );
  assert.equal(out[0].answerIndex, 2);
});

test("annotateAnswerIndex matches object criteria by id or name", () => {
  const out = annotateAnswerIndex(
    [{ name: "Kosa kata", score: 80 }],
    [{ criteria: [{ id: "kosa_kata" }] }],
  );
  assert.equal(out[0].answerIndex, 0);
});
