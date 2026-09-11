const test = require("node:test");
const assert = require("node:assert/strict");
const {
  criterionIsGrounded,
  groundQuestion,
  groundQuestionsAgainstRubric,
  repairQuestionClarity,
  validateQuestionCriterionGrounding,
} = require("../server/harness/question-grounding");

test("criterion contoh penerapan tidak grounded jika soal tidak meminta contoh", () => {
  const question = {
    prompt: "Pilihlah salah satu cabang filsafat yang menurut Anda paling relevan dalam kehidupan sehari-hari.",
    criteria: [
      { id: "k1", name: "Ketepatan identifikasi cabang filsafat" },
      { id: "k2", name: "Kedalaman alasan relevansi" },
      { id: "k3", name: "Kesesuaian contoh penerapan" },
    ],
  };

  const grounded = groundQuestion(question);
  assert.equal(grounded.prompt, "Pilihlah salah satu cabang filsafat yang menurut Anda paling relevan dalam kehidupan sehari-hari, lalu jelaskan alasan pilihan Anda.");
  assert.deepEqual(
    grounded.criteria.map((criterion) => criterion.name),
    ["Ketepatan identifikasi cabang filsafat", "Kedalaman alasan relevansi"]
  );
  assert.equal(grounded.evidenceGrounding.removedCriteria[0].name, "Kesesuaian contoh penerapan");
});

test("criterion penerapan hanya valid bila question meminta evidence penerapan", () => {
  assert.equal(
    criterionIsGrounded("Jelaskan penerapan konsep tersebut pada satu situasi konkret.", "Kesesuaian contoh penerapan"),
    true
  );
  assert.equal(
    criterionIsGrounded("Pilih konsep yang paling relevan.", "Kesesuaian contoh penerapan"),
    false
  );
});

test("vague selection question is repaired without adding an example demand", () => {
  const repaired = repairQuestionClarity("Pilih satu cabang filsafat yang paling relevan dalam kehidupan sehari-hari.");
  assert.match(repaired, /jelaskan alasan pilihan Anda/i);
  assert.doesNotMatch(repaired, /contoh|penerapan/i);
});

test("grounding never leaves an unsupported criterion behind", () => {
  const questions = groundQuestionsAgainstRubric([
    {
      prompt: "Pilih satu konsep yang paling relevan.",
      criteria: [{ id: "k1", name: "Kesesuaian contoh penerapan" }],
    },
  ]);
  assert.equal(validateQuestionCriterionGrounding(questions[0]).valid, true);
  assert.equal(questions[0].criteria.length, 0);
  assert.equal(questions[0].evidenceGrounding.status, "PARTIAL");
});
