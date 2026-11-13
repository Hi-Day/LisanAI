-- Lecturer-chosen mapping from an LMS resource link (BINUS Maya content item) to a
-- LisanAI assessment and the class whose roster LTI learners are enrolled into.
-- BINUS Maya cannot send custom launch parameters, so the first instructor launch maps it.
CREATE TABLE IF NOT EXISTS lti_resource_links (
  consumer_key TEXT NOT NULL,
  context_id TEXT NOT NULL,
  resource_link_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  mapped_by TEXT NOT NULL,
  resource_title TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (consumer_key, context_id, resource_link_id),
  FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_lti_resource_links_assessment ON lti_resource_links(tenant_id, assessment_id);
