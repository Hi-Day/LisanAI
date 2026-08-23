-- PERFORMANCE: enable index-backed ordering for the hot tenant-scoped list
-- queries. created_at / submitted_at are stored as ISO-8601 strings, so a plain
-- ORDER BY <col> orders identically to datetime(<col>) but SQLite can use an
-- index (a function call in the sort key defeats the index).
CREATE INDEX IF NOT EXISTS idx_assessments_tenant_created
  ON assessments (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_assessments_tenant_teacher_created
  ON assessments (tenant_id, teacher_id, created_at);
CREATE INDEX IF NOT EXISTS idx_submissions_tenant_created
  ON submissions (tenant_id, submitted_at);
CREATE INDEX IF NOT EXISTS idx_submissions_tenant_user
  ON submissions (tenant_id, user_id, submitted_at);
CREATE INDEX IF NOT EXISTS idx_class_memberships_tenant_class
  ON class_memberships (tenant_id, class_id, student_id);
CREATE INDEX IF NOT EXISTS idx_classes_tenant_teacher
  ON classes (tenant_id, teacher_id, created_at);