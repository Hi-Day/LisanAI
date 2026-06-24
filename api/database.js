const {
  approveMembership,
  clearData,
  createClass,
  deleteAssessment,
  deleteClass,
  deleteMembership,
  getState,
  requestJoinClass,
  saveAssessment,
  saveSubmission,
  updateAssessment,
  updateClass,
  updateMembershipStatus,
} = require("../server/database");
const {
  createTenantUser,
  deleteTenantUser,
  getSessionUser,
  listTenantUsers,
  updateTenantUser,
  createTenantUsersBatch,
  SESSION_COOKIE,
} = require("../server/auth-service");
const { initDatabase } = require("../server/database");
const { parseCookies, readJson, sendJson } = require("../server/http-utils");
const crypto = require("node:crypto");

let isDbInitialized = false;

function cryptoRandom() {
  return crypto.randomUUID().replace(/-/g, "");
}

module.exports = async (req, res) => {
  try {
    if (!isDbInitialized) {
      await initDatabase();
      isDbInitialized = true;
    }

    const auth = await getSessionUser(parseCookies(req)[SESSION_COOKIE]);
    if (!auth) return sendJson(res, 401, { error: "Unauthorized" });

    if (req.method === "GET") {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const action = url.searchParams.get("action");

      if (action === "state") {
        return sendJson(res, 200, await getState(auth));
      }

      if (action === "users") {
        if (auth.user.role !== "admin") return sendJson(res, 403, { error: "Forbidden" });
        return sendJson(res, 200, { users: await listTenantUsers(auth.tenant.id) });
      }

      return sendJson(res, 404, { error: "Action not found" });
    }

    if (req.method === "POST") {
      const { assertCsrfToken } = require("../server/auth-service");
      try {
        assertCsrfToken(req, auth);
      } catch (csrfError) {
        return sendJson(res, 403, { error: csrfError.message });
      }

      const body = await readJson(req);
      const { action, payload, id } = body;

      // Admin & Teacher Only Actions
      const isTeacherOrAdmin = ["admin", "teacher"].includes(auth.user.role);
      const isAdmin = auth.user.role === "admin";
      const isTeacher = auth.user.role === "teacher";
      const isStudent = auth.user.role === "student";

      if (action === "clear-data") {
        if (!isTeacherOrAdmin) return sendJson(res, 403, { error: "Forbidden" });
        await clearData(auth.tenant.id);
        return sendJson(res, 200, { ok: true });
      }

      // Assessments
      if (action === "save-assessment") {
        if (!isTeacherOrAdmin) return sendJson(res, 403, { error: "Forbidden" });
        await saveAssessment(auth, payload);
        return sendJson(res, 201, { assessment: payload });
      }
      if (action === "update-assessment") {
        if (!isTeacherOrAdmin) return sendJson(res, 403, { error: "Forbidden" });
        const assessment = await updateAssessment(auth, id, payload);
        return sendJson(res, 200, { assessment });
      }
      if (action === "delete-assessment") {
        if (!isTeacherOrAdmin) return sendJson(res, 403, { error: "Forbidden" });
        await deleteAssessment(auth, id);
        return sendJson(res, 200, { ok: true });
      }

      // Submissions
      if (action === "save-submission") {
        if (isStudent) {
          await saveSubmission(auth.tenant.id, auth.user.id, payload);
          return sendJson(res, 201, { submission: payload });
        } else if (isTeacherOrAdmin) {
          const { getDb } = require("../server/database");
          const database = getDb();
          const existing = await database.get(
            "SELECT * FROM submissions WHERE id = ? AND tenant_id = ?",
            payload.id,
            auth.tenant.id
          );
          if (!existing) {
            return sendJson(res, 404, { error: "Submission tidak ditemukan" });
          }

          if (auth.user.role === "teacher") {
            const assessment = await database.get(
              "SELECT class_id FROM assessments WHERE id = ? AND tenant_id = ?",
              existing.assessment_id,
              auth.tenant.id
            );
            if (!assessment) {
              return sendJson(res, 404, { error: "Assessment tidak ditemukan" });
            }
            const classroom = await database.get(
              "SELECT teacher_id FROM classes WHERE id = ? AND tenant_id = ?",
              assessment.class_id,
              auth.tenant.id
            );
            if (!classroom || classroom.teacher_id !== auth.user.id) {
              return sendJson(res, 403, { error: "Guru hanya boleh mengoreksi kelas miliknya" });
            }
          }

          await saveSubmission(auth.tenant.id, existing.user_id, payload, true);
          return sendJson(res, 200, { submission: payload });
        } else {
          return sendJson(res, 403, { error: "Forbidden" });
        }
      }

      // Classes
      if (action === "create-class") {
        if (!isTeacherOrAdmin) return sendJson(res, 403, { error: "Forbidden" });
        const classroom = {
          id: `class-${cryptoRandom()}`,
          name: String(payload.name || "").trim(),
          joinCode: cryptoRandom().slice(0, 8).toUpperCase(),
          createdAt: new Date().toISOString(),
        };
        if (!classroom.name) throw Object.assign(new Error("Nama kelas wajib diisi"), { status: 400 });
        await createClass(auth.tenant.id, auth.user.id, classroom);
        return sendJson(res, 201, { class: classroom });
      }
      if (action === "update-class") {
        if (!isTeacherOrAdmin) return sendJson(res, 403, { error: "Forbidden" });
        const classroom = await updateClass(auth, id, payload);
        return sendJson(res, 200, { class: classroom });
      }
      if (action === "delete-class") {
        if (!isTeacherOrAdmin) return sendJson(res, 403, { error: "Forbidden" });
        await deleteClass(auth, id);
        return sendJson(res, 200, { ok: true });
      }

      // Memberships
      if (action === "join-class") {
        if (!isStudent) return sendJson(res, 403, { error: "Forbidden" });
        const classroom = await requestJoinClass(auth.tenant.id, auth.user.id, String(payload.joinCode || "").trim().toUpperCase(), {
          id: `member-${cryptoRandom()}`,
          requestedAt: new Date().toISOString(),
        });
        return sendJson(res, 201, { class: classroom });
      }
      if (action === "approve-membership") {
        if (!isTeacher) return sendJson(res, 403, { error: "Forbidden" });
        await approveMembership(auth.tenant.id, auth.user.id, payload.membershipId);
        return sendJson(res, 200, { ok: true });
      }
      if (action === "update-membership") {
        if (!isTeacher) return sendJson(res, 403, { error: "Forbidden" });
        await updateMembershipStatus(auth, id, payload.status);
        return sendJson(res, 200, { ok: true });
      }
      if (action === "delete-membership") {
        await deleteMembership(auth, id);
        return sendJson(res, 200, { ok: true });
      }

      // Users
      if (action === "create-user") {
        if (!isAdmin) return sendJson(res, 403, { error: "Forbidden" });
        const user = await createTenantUser(auth.tenant.id, payload);
        return sendJson(res, 201, { user });
      }
      if (action === "create-users-batch") {
        if (!isAdmin) return sendJson(res, 403, { error: "Forbidden" });
        const result = await createTenantUsersBatch(auth.tenant.id, payload);
        return sendJson(res, 201, result);
      }
      if (action === "update-user") {
        if (!isAdmin) return sendJson(res, 403, { error: "Forbidden" });
        const user = await updateTenantUser(auth.tenant.id, id, payload);
        return sendJson(res, 200, { user });
      }
      if (action === "delete-user") {
        if (!isAdmin) return sendJson(res, 403, { error: "Forbidden" });
        await deleteTenantUser(auth.tenant.id, id, auth.user.id);
        return sendJson(res, 200, { ok: true });
      }

      return sendJson(res, 404, { error: "Action not found" });
    }

    return sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    return sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
};
