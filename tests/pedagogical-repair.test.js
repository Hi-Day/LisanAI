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

test("rebuildRubricForCriteria leaves empty rubrics untouched", () => {
  assert.equal(rebuildRubricForCriteria("", [{ name: "A" }]), "");
});
