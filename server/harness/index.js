const { AssessmentHarness } = require("./harness");
const { PluginRegistry } = require("./registry");
const { Pipeline } = require("./pipeline");
const { Trace } = require("./trace");
const { defaultConfig } = require("./config");
const { validateRubric, validateOutput, validateCriterionEvaluation } = require("./validator");
const { MANIFEST_VERSION, buildHarnessManifest } = require("./manifest");

// Built-in plugins
const persona = require("./plugins/persona");
const assessmentContext = require("./plugins/assessmentContext");
const rubric = require("./plugins/rubric");
const evidence = require("./plugins/evidence");
const evaluation = require("./plugins/evaluation");
const verification = require("./plugins/verification");
const rubricAlignment = require("./alignment");

function createHarness(config = {}) {
  const harness = new AssessmentHarness(config);
  harness.register(persona);
  harness.register(assessmentContext);
  harness.register(rubric);
  harness.register(evidence);
  harness.register(evaluation);
  harness.register(verification);
  harness.register(rubricAlignment);
  return harness;
}

module.exports = {
  AssessmentHarness,
  PluginRegistry,
  Pipeline,
  Trace,
  createHarness,
  defaultConfig,
  validateRubric,
  validateOutput,
  validateCriterionEvaluation,
  MANIFEST_VERSION,
  buildHarnessManifest,
  plugins: {
    persona,
    assessmentContext,
    rubric,
    evidence,
    evaluation,
    verification,
    rubricAlignment,
  },
};
