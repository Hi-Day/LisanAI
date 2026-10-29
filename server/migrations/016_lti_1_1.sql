-- LTI 1.1 identity mapping and replay protection.
CREATE TABLE IF NOT EXISTS lti_nonces (
  consumer_key TEXT NOT NULL,
  nonce TEXT NOT NULL,
  oauth_timestamp INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (consumer_key, nonce)
);
CREATE INDEX IF NOT EXISTS idx_lti_nonces_created_at ON lti_nonces(created_at);

CREATE TABLE IF NOT EXISTS lti_identities (
  consumer_key TEXT NOT NULL,
  context_id TEXT NOT NULL,
  lti_user_id TEXT NOT NULL,
  user_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (consumer_key, context_id, lti_user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lti_outcome_bindings (
  consumer_key TEXT NOT NULL,
  context_id TEXT NOT NULL,
  resource_link_id TEXT NOT NULL,
  lti_user_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  assessment_id TEXT,
  outcome_url TEXT,
  sourced_id TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (consumer_key, context_id, resource_link_id, lti_user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_lti_outcome_submission
  ON lti_outcome_bindings(tenant_id, user_id, assessment_id);
