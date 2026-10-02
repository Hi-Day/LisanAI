CREATE TABLE IF NOT EXISTS assessment_classes (
  tenant_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  assigned_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, assessment_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_assessment_classes_class
  ON assessment_classes (tenant_id, class_id, status);

CREATE INDEX IF NOT EXISTS idx_assessment_classes_assessment
  ON assessment_classes (tenant_id, assessment_id, status);

INSERT OR IGNORE INTO assessment_classes
  (tenant_id, assessment_id, class_id, status, assigned_at)
SELECT tenant_id, id, class_id, COALESCE(status, 'published'), COALESCE(created_at, CURRENT_TIMESTAMP)
FROM assessments
WHERE tenant_id IS NOT NULL AND class_id IS NOT NULL AND TRIM(class_id) <> '';
