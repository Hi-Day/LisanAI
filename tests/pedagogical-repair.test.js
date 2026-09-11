const test = require("node:test");
const assert = require("node:assert/strict");

const { rebuildRubricForCriteria } = require("../server/pedagogical-repair");

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
