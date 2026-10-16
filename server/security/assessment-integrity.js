const crypto = require("node:crypto");

function stable(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stable);
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stable(value[key]);
    return out;
  }, {});
}

function canonicalJson(value) {
  return JSON.stringify(stable(value));
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function hashObject(value) {
  return sha256(canonicalJson(value));
}

function assessmentSnapshotHash(assessment) {
  return hashObject({
    id: assessment?.id || null,
    topic: assessment?.topic || "",
    outcomes: assessment?.outcomes || "",
    difficulty: assessment?.difficulty || "",
    timeLimit: Number(assessment?.timeLimit) || 0,
    questions: Array.isArray(assessment?.questions) ? assessment.questions : [],
    rubric: assessment?.rubric || "",
  });
}

function rubricHash(assessment) {
  return hashObject({
    rubric: assessment?.rubric || "",
    questions: (assessment?.questions || []).map((q) => ({
      id: q?.id || null,
      criteria: q?.criteria || [],
      rubric: q?.rubric || "",
    })),
  });
}

function answersHash(answers) {
  return hashObject(Array.isArray(answers) ? answers.map((a) => String(a || "")) : []);
}

module.exports = { canonicalJson, sha256, hashObject, assessmentSnapshotHash, rubricHash, answersHash };
