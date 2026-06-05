CREATE INDEX IF NOT EXISTS idx_assessments_tenant_class ON assessments (tenant_id, class_id);
CREATE INDEX IF NOT EXISTS idx_assessments_teacher ON assessments (teacher_id);
CREATE INDEX IF NOT EXISTS idx_memberships_class_student ON class_memberships (class_id, student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_assessment ON submissions (tenant_id, user_id, assessment_id);
