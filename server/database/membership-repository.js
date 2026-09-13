async function getVisibleMemberships(db, auth) {
  if (auth.user.role !== "teacher") return [];
  return db.all(`SELECT class_memberships.*, users.name AS student_name, users.email AS student_email, classes.name AS class_name
     FROM class_memberships JOIN users ON users.id = class_memberships.student_id JOIN classes ON classes.id = class_memberships.class_id
     WHERE class_memberships.tenant_id = ? AND classes.teacher_id = ? ORDER BY class_memberships.requested_at DESC`, auth.tenant.id, auth.user.id);
}

async function approveMembership(db, tenantId, teacherId, membershipId) {
  const result = await db.run(`UPDATE class_memberships SET status = 'approved', approved_at = ? WHERE id = ? AND tenant_id = ? AND class_id IN (SELECT id FROM classes WHERE teacher_id = ?)`, new Date().toISOString(), membershipId, tenantId, teacherId);
  if (!result.changes) throw Object.assign(new Error("Request join tidak ditemukan"), { status: 404 });
}

async function updateMembershipStatus(db, auth, membershipId, status) {
  if (!["approved", "rejected", "pending"].includes(status)) throw Object.assign(new Error("Status membership tidak valid"), { status: 400 });
  const result = await db.run(`UPDATE class_memberships SET status = ?, approved_at = CASE WHEN ? = 'approved' THEN ? ELSE approved_at END
     WHERE id = ? AND tenant_id = ? AND class_id IN (SELECT id FROM classes WHERE teacher_id = ?)`, status, status, new Date().toISOString(), membershipId, auth.tenant.id, auth.user.id);
  if (!result.changes) throw Object.assign(new Error("Membership tidak ditemukan"), { status: 404 });
}

async function deleteMembership(db, auth, membershipId) {
  const result = await db.run(`DELETE FROM class_memberships WHERE id = ? AND tenant_id = ? AND (student_id = ? OR class_id IN (SELECT id FROM classes WHERE teacher_id = ?))`, membershipId, auth.tenant.id, auth.user.id, auth.user.id);
  if (!result.changes) throw Object.assign(new Error("Membership tidak ditemukan"), { status: 404 });
}

module.exports = { getVisibleMemberships, approveMembership, updateMembershipStatus, deleteMembership };
