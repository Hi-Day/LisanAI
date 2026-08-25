const {
  approveMembership,
  createClass,
  deleteAssessment,
  deleteClass,
  deleteMembership,
  getState,
  getSubmissionDetail,
  getDb,
  requestJoinClass,
  saveAssessment,
  saveSubmission,
  updateAssessment,
  updateClass,
  updateMembershipStatus,
  saveQuestionToBank,
  listQuestionBank,
  deleteQuestionFromBank,
} = require("../server/database");
const { listTenantUsers, updateTenantUser, createTenantUser, deleteTenantUser, getSessionUser, createTenantUsersBatch, SESSION_COOKIE } = require("../server/auth-service");
const { ensureDatabase } = require("../server/bootstrap");
const { parseCookies, readJson, sendJson } = require("../server/http-utils");
const { recordTeacherScoreChange } = require("../server/evaluation/research");
const crypto = require("node:crypto");

function cryptoRandom() {
  return crypto.randomUUID().replace(/-/g, "");
}

module.exports = async (req, res) => {
  try {
    await ensureDatabase();

    const auth = await getSessionUser(parseCookies(req)[SESSION_COOKIE]);
    if (!auth) return sendJson(res, 401, { error: "Unauthorized" });

    if (req.method === "GET") {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const action = url.searchParams.get("action");

      if (action === "state") {
        return sendJson(res, 200, await getState(auth));
      }

      if (action === "submission") {
        const submissionId = url.searchParams.get("id");
        if (!submissionId) return sendJson(res, 400, { error: "Parameter id wajib" });
        return sendJson(res, 200, { submission: await getSubmissionDetail(auth, submissionId) });
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

      // Seed dummy data so every menu can be presented during a demo.
      // target: "teacher" | "admin" (admin also seeds observability/research/api keys).
      if (action === "seed-demo") {
        if (!isTeacherOrAdmin) return sendJson(res, 403, { error: "Forbidden" });
        const { seedDemoData } = require("../server/seed-demo");
        const target = payload && payload.target;
        if (target !== "teacher" && target !== "admin") {
          return sendJson(res, 400, { error: "target wajib 'teacher' atau 'admin'" });
        }
        const result = await seedDemoData(auth, target);
        return sendJson(res, 200, result);
      }

      // Remove ONLY the demo (dummy) data, leaving original data intact.
      if (action === "remove-demo-data") {
        if (!isTeacherOrAdmin) return sendJson(res, 403, { error: "Forbidden" });
        const { removeDemoData } = require("../server/seed-demo");
        const result = await removeDemoData(auth.tenant.id);
        return sendJson(res, 200, result);
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

      // Question Bank
      if (action === "save-question-bank") {
        if (!isTeacherOrAdmin) return sendJson(res, 403, { error: "Forbidden" });
        const result = await saveQuestionToBank(auth, payload);
        return sendJson(res, 201, { id: result.id });
      }
      if (action === "list-question-bank") {
        if (!isTeacherOrAdmin) return sendJson(res, 403, { error: "Forbidden" });
        const questions = await listQuestionBank(auth, payload || {});
        return sendJson(res, 200, { questions });
      }
      if (action === "delete-question-bank") {
        if (!isTeacherOrAdmin) return sendJson(res, 403, { error: "Forbidden" });
        await deleteQuestionFromBank(auth, id);
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

          // Teacher corrected the score (direct override or accepted a
          // complaint). Record the new value as the human score for the
          // linked harness run so it enters the AI-vs-human research dataset,
          // and stop the 7-day auto-approval from overwriting it.
          try {
            const prev = (() => {
              try {
                return JSON.parse(existing.payload || "{}");
              } catch {
                return {};
              }
            })();
            const runId = payload.evaluationRunId || prev.evaluationRunId;
            if (runId && payload.finalScore !== undefined && payload.finalScore !== null) {
              const record = await recordTeacherScoreChange({
                runId,
                finalScore: payload.finalScore,
                tenantId: auth.tenant.id,
                reviewerId: auth.user.id,
                reviewNote:
                  (payload.questionScores || []).find((qs) => qs && qs.complaint && qs.complaint.status === "resolved")
                    ? "Komplain siswa diterima."
                    : "",
              });
              if (record) {
                console.log(
                  `[research] human score recorded for run ${record.runId}: ${record.previousScore} -> ${record.humanScore} (${record.approvalStatus})`
                );
              }
            }
          } catch (recErr) {
            // Recording the human score must never block the teacher's save.
            console.error("[research] recordTeacherScoreChange failed:", recErr);
          }

          return sendJson(res, 200, { submission: payload });
        } else {
          return sendJson(res, 403, { error: "Forbidden" });
        }
      }

      // Student submits a complaint on a specific question of their own submission.
      if (action === "submit-complaint") {
        if (!isStudent) return sendJson(res, 403, { error: "Forbidden" });
        const { submissionId, questionIndex, reason } = payload || {};
        if (!submissionId || questionIndex === undefined || !String(reason || "").trim()) {
          return sendJson(res, 400, { error: "Alasan komplain wajib diisi" });
        }

        const database = getDb();
        const existing = await database.get(
          "SELECT * FROM submissions WHERE id = ? AND tenant_id = ? AND user_id = ?",
          submissionId,
          auth.tenant.id,
          auth.user.id
        );
        if (!existing) {
          return sendJson(res, 404, { error: "Submission tidak ditemukan" });
        }

        const submission = JSON.parse(existing.payload);
        const qs = submission.questionScores?.[questionIndex];
        if (!qs) {
          return sendJson(res, 400, { error: "Soal tidak ditemukan" });
        }

        qs.complaint = {
          reason: String(reason).trim(),
          status: "pending",
          submittedAt: new Date().toISOString(),
        };

        await saveSubmission(auth.tenant.id, auth.user.id, submission, true);
        return sendJson(res, 200, { submission });
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
      if (action === "add-students-to-class") {
        if (!isTeacher) return sendJson(res, 403, { error: "Forbidden" });
        const { classId, emails } = payload || {};
        if (!classId || !Array.isArray(emails)) return sendJson(res, 400, { error: "Payload tidak valid" });

        const added = [];
        const errors = [];
        for (const email of emails) {
          try {
            const normalized = String(email || "").trim().toLowerCase();
            if (!normalized) throw new Error("Email kosong");
            const user = await listTenantUsers(auth.tenant.id).then(list => list.find(u => u.email === normalized));
            if (!user) throw new Error("User tidak ditemukan");

            const membershipId = `member-${cryptoRandom()}`;
            const now = new Date().toISOString();
            await getState; // noop to keep flow (no-op)
            await getDb().run(
              `INSERT OR REPLACE INTO class_memberships (id, tenant_id, class_id, student_id, status, requested_at, approved_at)
               VALUES (?, ?, ?, ?, 'approved', ?, ?)`,
              membershipId,
              auth.tenant.id,
              classId,
              user.id,
              now,
              now
            );
            added.push({ id: user.id, email: user.email });
          } catch (err) {
            errors.push({ email, message: err.message });
          }
        }

        return sendJson(res, 200, { added, errors });
      }
      if (action === "create-students-batch") {
        if (!isTeacher) return sendJson(res, 403, { error: "Forbidden" });
        const { classId, users } = payload || {};
        if (!classId || !Array.isArray(users)) return sendJson(res, 400, { error: "Payload tidak valid" });

        // Verify class belongs to teacher
        const classroom = await getDb().get("SELECT id FROM classes WHERE id = ? AND tenant_id = ? AND teacher_id = ?", classId, auth.tenant.id, auth.user.id);
        if (!classroom) return sendJson(res, 404, { error: "Kelas tidak ditemukan atau tidak milik Anda" });

        const added = [];
        const errors = [];
        for (const [index, u] of users.entries()) {
          try {
            const name = String(u.name || '').trim();
            const email = String(u.email || '').trim().toLowerCase();
            const password = String(u.password || '');
            const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!name) throw new Error('Nama kosong');
            if (!emailRe.test(email)) throw new Error('Email tidak valid');
            if (password.length < 8) throw new Error('Password minimal 8 karakter');

            const user = await createTenantUser(auth.tenant.id, { name, email, password, role: 'student' });

            const membershipId = `member-${cryptoRandom()}`;
            const now = new Date().toISOString();
            await getDb().run(
              `INSERT OR REPLACE INTO class_memberships (id, tenant_id, class_id, student_id, status, requested_at, approved_at)
               VALUES (?, ?, ?, ?, 'approved', ?, ?)`,
              membershipId,
              auth.tenant.id,
              classId,
              user.id,
              now,
              now
            );

            added.push({ id: user.id, email: user.email });
          } catch (err) {
            errors.push({ row: index + 1, email: u.email, message: err.message });
          }
        }

        return sendJson(res, 201, { added, errors });
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
