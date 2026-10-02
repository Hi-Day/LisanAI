const test = require("node:test");
const assert = require("node:assert/strict");

test("competency profile keeps same LO id separate when outcome text differs", async () => {
  const { buildCompetencyProfile } = await import("../src/js/competency-profile.js");
  const assessments = [
    { id: "a1", outcomes: "LO1: Menjelaskan konsep", questions: [{ learningOutcomeId: "LO1", prompt: "q1" }] },
    { id: "a2", outcomes: "LO1: Menerapkan konsep", questions: [{ learningOutcomeId: "LO1", prompt: "q2" }] },
  ];
  const submissions = [
    { id: "s1", assessmentId: "a1", studentName: "S", questionScores: [{ score: 80 }] },
    { id: "s2", assessmentId: "a2", studentName: "S", questionScores: [{ score: 60 }] },
  ];
  const profile = buildCompetencyProfile(assessments, submissions);
  assert.equal(profile.length, 2);
  assert.deepEqual(profile.map((x) => x.name).sort(), ["Menerapkan konsep", "Menjelaskan konsep"]);
});

test("competency profile contributes one question to every mapped learning outcome", async () => {
  const { buildCompetencyProfile } = await import("../src/js/competency-profile.js");
  const assessment = {
    id: "a1",
    outcomes: [
      { id: "LO1", text: "Menjelaskan konsep" },
      { id: "LO2", text: "Menerapkan konsep" },
    ],
    questions: [{ learningOutcomeIds: ["LO1", "LO2"], learningOutcomeId: "LO1", prompt: "q1" }],
  };
  const profile = buildCompetencyProfile([assessment], [
    { id: "s1", assessmentId: "a1", studentName: "S", questionScores: [{ score: 90 }] },
  ]);
  assert.deepEqual(profile.map((x) => x.id).sort(), ["LO1", "LO2"]);
  assert.equal(profile.find((x) => x.id === "LO1").avg, 90);
  assert.equal(profile.find((x) => x.id === "LO2").avg, 90);
});

test("learning outcome resolver returns every explicitly mapped LO", async () => {
  const { resolveLearningOutcomes } = await import("../src/js/competency-profile.js");
  const outcomes = [
    { id: "LO1", text: "Menjelaskan konsep" },
    { id: "LO2", text: "Menerapkan konsep" },
  ];
  const mapped = resolveLearningOutcomes({ learningOutcomeIds: ["LO1", "LO2"] }, outcomes);
  assert.deepEqual(mapped.map((x) => x.id), ["LO1", "LO2"]);
});

test("competency profile resolves LO from criterion mapping when answerIndex is unavailable", async () => {
  const { buildCompetencyProfile } = await import("../src/js/competency-profile.js");
  const assessment = {
    id: "a1",
    outcomes: [{ id: "LO1", text: "Menjelaskan konsep" }],
    questions: [{
      learningOutcomeId: "LO1",
      prompt: "q1",
      criteria: [{ id: "c1", name: "Ketepatan konsep" }],
    }],
  };
  const profile = buildCompetencyProfile([assessment], [{
    id: "s1",
    assessmentId: "a1",
    studentName: "S",
    criteria: [{ criterionId: "c1", score: 85 }],
  }]);
  assert.equal(profile.length, 1);
  assert.equal(profile[0].id, "LO1");
  assert.equal(profile[0].avg, 85);
});
