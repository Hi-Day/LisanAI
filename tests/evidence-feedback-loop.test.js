const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyEvidenceFeedbackLoop,
  competencyLevel,
  deriveCompetencyState,
} = require("../server/evidence-feedback-loop");

test("marks probe evidence as additional evidence and preserves verified score", () => {
  const assessment = {
    outcomes: [{ id: "LO1", text: "Menjelaskan konsep" }],
    questions: [{ id: "q1", learningOutcomeId: "LO1" }],
  };
  const submission = {
    finalScore: 80,
    questionScores: [{
      score: 80,
      evidence: [{ text: "jawaban awal" }],
      probing: {
        status: "accepted",
        prompt: "Apa alasannya?",
        answer: "Karena proses tersebut membutuhkan energi.",
        evidenceGap: { type: "RATIONALE", label: "Alasan belum jelas" },
      },
    }],
  };

  const result = applyEvidenceFeedbackLoop(submission, assessment);
  assert.equal(result.scoreState, "VERIFIED_AFTER_ADAPTIVE_PROBING");
  assert.equal(result.evidenceFeedback.probeCount, 1);
  assert.equal(result.evidenceFeedback.additionalEvidenceCount, 1);
  assert.equal(result.evidenceFeedback.questions[0].probeDecision, "ACCEPTED");
  assert.equal(result.evidenceFeedback.questions[0].score.verifiedAfterProbing, 80);
  assert.equal(result.competencyState[0].learningOutcomeId, "LO1");
  assert.equal(result.competencyState[0].level, "DEVELOPING");
  assert.equal(result.competencyState[0].probingCount, 1);
});

test("does not manufacture a before-probe score", () => {
  const result = applyEvidenceFeedbackLoop({
    finalScore: 90,
    questionScores: [{ score: 90, probing: { status: "accepted", answer: "tambahan" } }],
  }, { questions: [], outcomes: [] });
  assert.equal(result.evidenceFeedback.questions[0].score.beforeProbing, null);
  assert.equal(result.evidenceFeedback.questions[0].score.delta, null);
});

test("competency levels are deterministic", () => {
  assert.equal(competencyLevel(90, true), "MASTERED");
  assert.equal(competencyLevel(75, true), "DEVELOPING");
  assert.equal(competencyLevel(50, true), "NEEDS_SUPPORT");
  assert.equal(competencyLevel(0, false), "INSUFFICIENT_EVIDENCE");
});

test("groups competency by learning outcome, not criterion", () => {
  const state = deriveCompetencyState(
    {
      outcomes: "LO1 — Konsep; LO2 — Penerapan",
      questions: [
        { learningOutcomeId: "LO1" },
        { learningOutcomeId: "LO1" },
        { learningOutcomeId: "LO2" },
      ],
    },
    [
      { score: 80, evidence: [{ text: "a" }] },
      { score: 90, evidence: [{ text: "b" }] },
      { score: 60, evidence: [{ text: "c" }] },
    ]
  );
  assert.deepEqual(state.map((x) => [x.learningOutcomeId, x.score, x.level]), [
    ["LO1", 85, "MASTERED"],
    ["LO2", 60, "NEEDS_SUPPORT"],
  ]);
});
