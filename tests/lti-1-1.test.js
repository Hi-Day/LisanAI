const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateOAuthSignature,
  normalizeParameters,
  normalizedBaseUrl,
  parseForm,
  roleFromLti,
  verifyLaunch,
} = require("../server/lti");

test("LTI OAuth parameter normalization encodes and sorts key/value pairs", () => {
  assert.equal(normalizeParameters({ b: "two words", a: "1", oauth_signature: "ignored" }), "a=1&b=two%20words");
});
test("LTI base URL removes default port and query string", () => {
  assert.equal(normalizedBaseUrl("https://EXAMPLE.com:443/api/lti?x=1"), "https://example.com/api/lti");
});
test("LTI launch signature verifies with HMAC-SHA1 and rejects tampering", () => {
  const url = "https://tool.example.edu/api/lti";
  const parameters = {
    lti_message_type: "basic-lti-launch-request",
    oauth_consumer_key: "maya-test",
    oauth_nonce: "nonce-1",
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: "1.0",
    user_id: "student-1",
  };
  process.env.LTI_CONSUMERS_JSON = JSON.stringify({ "maya-test": "test-secret" });
  parameters.oauth_signature = calculateOAuthSignature({ url, parameters, consumerSecret: "test-secret" });
  assert.equal(verifyLaunch(parameters, url).consumerKey, "maya-test");
  assert.throws(() => verifyLaunch({ ...parameters, user_id: "attacker" }, url), /signature/i);
  delete process.env.LTI_CONSUMERS_JSON;
});
test("LTI form parsing preserves duplicate fields instead of silently discarding them", () => {
  assert.deepEqual(parseForm("role=Student&role=Instructor&context_id=abc"), { role: ["Student", "Instructor"], context_id: "abc" });
});
test("LTI roles map known instructor and learner vocabularies only", () => {
  assert.equal(roleFromLti("Instructor"), "teacher");
  assert.equal(roleFromLti("urn:lti:role:ims/lis/Learner"), "student");
  assert.throws(() => roleFromLti("Administrator"), /Role LTI tidak dikenali/);
});
