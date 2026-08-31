const assert = require("node:assert/strict");
const test = require("node:test");
const { createHarness } = require("../server/harness");
const { buildHarnessManifest, MANIFEST_VERSION } = require("../server/harness/manifest");

test("harness manifest captures registered component versions and enabled state", () => {
  const harness = createHarness({ pipeline: { evidence: false } });
  const manifest = harness.getManifest();

  assert.equal(manifest.manifestVersion, MANIFEST_VERSION);
  assert.equal(manifest.harnessVersion, harness.config.version);
  assert.equal(manifest.engineVersion, harness.config.engineVersion);

  const evidence = manifest.components.find((c) => c.name === "evidence");
  const rubric = manifest.components.find((c) => c.name === "rubric");
  assert.ok(evidence);
  assert.ok(rubric);
  assert.equal(evidence.enabled, false);
  assert.equal(rubric.enabled, true);
  assert.ok(evidence.version);
  assert.ok(rubric.version);
});

test("manifest builder is deterministic for the same config and plugin set", () => {
  const config = { version: "1.0.0", engineVersion: "1.0.0", model: { provider: "test", model: "mock" }, pipeline: { rubric: true } };
  const plugins = [
    { name: "rubric", version: "2.0.0" },
    { name: "verification", version: "3.1.0" },
  ];
  const a = buildHarnessManifest({ config, plugins });
  const b = buildHarnessManifest({ config, plugins });
  assert.deepEqual(a, b);
});
