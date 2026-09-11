const test = require("node:test");
const assert = require("node:assert/strict");

const {
  rebuildRubricForCriteria,
  affectedQuestionIndexes,
  mergeOnlyAffectedQuestions,
} = require("../server/pedagogical-repair");

test("rebuildRubricForCriteria keeps only grounded criteria and renormalizes weights", () => {
  const rubric = JSON.stringify({
    version: "2",
    criteria: [
      { id: "a", name: "Ketepatan konsep", weight: 40 },
      { id: "b", name: "Kedalaman alasan", weight: 35 },
      { id: "c", name: "Kesesuaian contoh", weight: 25 },
    ],
  });

  const rebuilt = JSON.parse(rebuildRubricForCriteria(rubric, [
    { id: "a", name: "Ketepatan konsep" },
    { id: "b", name: "Kedalaman alasan" },
  ]));

  assert.equal(rebuilt.criteria.length, 2);
  assert.deepEqual(rebuilt.criteria.map((item) => item.name), ["Ketepatan konsep", "Kedalaman alasan"]);
  assert.equal(rebuilt.criteria.reduce((sum, item) => sum + item.weight, 0), 100);
});

test("rebuildRubricForCriteria removes stale rubric criteria after AI changes criterion names", () => {
  const rubric = JSON.stringify({
    version: "2",
    criteria: [
      { id: "old-a", name: "Definisi bronkitis", weight: 40 },
      { id: "old-b", name: "Penyebab bronkitis", weight: 60 },
    ],
  });

  const rebuilt = rebuildRubricForCriteria(rubric, [
    { id: "new-a", name: "Ketepatan menjelaskan pertukaran gas", weight: 70 },
    { id: "new-b", name: "Kejelasan mekanisme difusi", weight: 30 },
  ]);

  assert.match(rebuilt, /Ketepatan menjelaskan pertukaran gas/);
  assert.match(rebuilt, /Kejelasan mekanisme difusi/);
  assert.doesNotMatch(rebuilt, /Definisi bronkitis/);
  assert.doesNotMatch(rebuilt, /Penyebab bronkitis/);
});

test("rebuildRubricForCriteria leaves empty criteria as an empty rubric", () => {
  assert.equal(rebuildRubricForCriteria("", []), "");
});

test("affectedQuestionIndexes returns only questions reported as problematic", () => {
  assert.deepEqual(
    [...affectedQuestionIndexes({ issues: [{ index: 1 }, { questionIndex: 1 }, { index: 4 }] }, 5)].sort((a, b) => a - b),
    [1, 4]
  );
});

test("mergeOnlyAffectedQuestions preserves unrelated questions byte-for-byte in the normalized shape", () => {
  const original = [
    {
      id: "q1",
      prompt: "Soal satu tetap.",
      focus: "fokus satu",
      outcome: "LO1",
      rubric: "Kriteria satu 100%",
      ideal: "Jawaban satu",
      criteria: [{ id: "c1", name: "Kriteria satu", weight: 100 }],
      probing: false,
    },
    {
      id: "q2",
      prompt: "Soal dua bermasalah.",
      focus: "fokus dua",
      outcome: "LO2",
      rubric: "Kriteria lama 100%",
      ideal: "Jawaban dua",
      criteria: [{ id: "c2", name: "Kriteria lama", weight: 100 }],
      probing: true,
    },
  ];
  const candidate = [
    {
      ...original[0],
      prompt: "Soal satu seharusnya tidak berubah.",
      criteria: [{ id: "new1", name: "AI menambahkan criterion yang tidak diminta", weight: 100 }],
    },
    {
      ...original[1],
      prompt: "Soal dua sudah diperbaiki.",
      criteria: [{ id: "c2-new", name: "Kriteria baru", weight: 100 }],
    },
  ];

  const merged = mergeOnlyAffectedQuestions(original, candidate, { issues: [{ index: 1 }] });
  assert.deepEqual(merged[0], original[0]);
  assert.equal(merged[1].prompt, "Soal dua sudah diperbaiki.");
  assert.deepEqual(merged[1].criteria, [{ id: "c2-new", name: "Kriteria baru", weight: 100 }]);
  assert.equal(merged[1].probing, true);
});
