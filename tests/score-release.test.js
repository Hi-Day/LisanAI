const test = require("node:test");
const assert = require("node:assert/strict");
const { isScoreReleased, pendingRelease, releasedBy, stripScoreMentions, toStudentView } = require("../server/score-release");

test("legacy submissions without scoreRelease stay visible", () => {
  const legacy = { id: "s1", finalScore: 70, questionScores: [{ score: 70 }] };
  assert.equal(isScoreReleased(legacy), true);
  assert.equal(toStudentView(legacy), legacy);
});

test("released submissions are returned unchanged", () => {
  const released = { id: "s2", finalScore: 90, scoreRelease: releasedBy("teacher-1") };
  assert.equal(toStudentView(released), released);
});

test("pending view is a whitelist: unknown score-bearing fields never leak", () => {
  const view = toStudentView({
    id: "s3", assessmentId: "a", finalScore: 55, insight: "Kriteria terlemah 40", risk: { score: 0.7 },
    verification: { scoreConsistency: { coverage: 1 } }, competencyState: [{ score: 55 }], futureScoreField: 12,
    questionScores: [{ question: "Q", answer: "A", score: 55, confidence: 0.8, criterionIds: ["c"], strengths: ["Jelas"], gaps: ["Skor 2/4 pada contoh."] , probing: { prompt: "P", answer: "B", score: 50 } }],
    scoreRelease: pendingRelease(),
  });
  assert.deepEqual(Object.keys(view).sort(), ["assessmentId", "assessmentTitle", "classId", "evaluationSource", "feedback", "id", "questionScores", "scoreRelease", "status", "studentName", "submittedAt"].sort());
  assert.deepEqual(Object.keys(view.questionScores[0]).sort(), ["answer", "gaps", "matched", "probing", "question", "strengths", "unanswered"].sort());
  assert.deepEqual(view.questionScores[0].gaps, []);
  assert.deepEqual(view.questionScores[0].probing, { prompt: "P", answer: "B" });
});

test("score sentences are removed from feedback text, other sentences kept", () => {
  assert.equal(stripScoreMentions("Penjelasan runtut. Skor akhir 82 dari 100. Tambahkan contoh."), "Penjelasan runtut. Tambahkan contoh.");
  assert.equal(stripScoreMentions("Nilai Anda 70/100"), "");
  assert.equal(stripScoreMentions("Sebutkan 3 contoh nyata."), "Sebutkan 3 contoh nyata.");
});
