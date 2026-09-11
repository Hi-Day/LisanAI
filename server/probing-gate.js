const crypto = require("node:crypto");
const { getDb } = require("./database");

async function ensureTable() {
  await getDb().exec(`
    CREATE TABLE IF NOT EXISTS probing_sessions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      assessment_id TEXT NOT NULL,
      class_id TEXT,
      student_id TEXT NOT NULL,
      teacher_id TEXT,
      question_index INTEGER NOT NULL,
      answer TEXT,
      evidence_gap TEXT,
      proposed_prompt TEXT NOT NULL,
      approved_prompt TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      decision_note TEXT,
      created_at TEXT NOT NULL,
      decided_at TEXT,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_probing_sessions_teacher_status
      ON probing_sessions(tenant_id, teacher_id, status, created_at);
    CREATE INDEX IF NOT EXISTS idx_probing_sessions_student_status
      ON probing_sessions(tenant_id, student_id, status, created_at);
  `);
}

function id() {
  return `probe-${crypto.randomUUID()}`;
}

async function createProbe(auth, payload) {
  await ensureTable();
  if (auth.user.role !== "student") throw Object.assign(new Error("Hanya siswa yang dapat membuat probe"), { status: 403 });
  const db = getDb();
  const assessment = await db.get(
    `SELECT id, class_id, teacher_id FROM assessments WHERE id = ? AND tenant_id = ?`,
    payload.assessmentId,
    auth.tenant.id
  );
  if (!assessment) throw Object.assign(new Error("Assessment tidak ditemukan"), { status: 404 });
  const membership = await db.get(
    `SELECT id FROM class_memberships WHERE tenant_id = ? AND class_id = ? AND student_id = ? AND status = 'approved'`,
    auth.tenant.id,
    assessment.class_id,
    auth.user.id
  );
  if (!membership) throw Object.assign(new Error("Siswa belum terdaftar pada kelas assessment"), { status: 403 });

  const probeId = id();
  const now = new Date();
  const expires = new Date(now.getTime() + 30000);
  await db.run(
    `INSERT INTO probing_sessions
      (id, tenant_id, assessment_id, class_id, student_id, teacher_id, question_index, answer, evidence_gap, proposed_prompt, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    probeId,
    auth.tenant.id,
    assessment.id,
    assessment.class_id,
    auth.user.id,
    assessment.teacher_id,
    Number(payload.questionIndex) || 0,
    String(payload.answer || ""),
    JSON.stringify(payload.evidenceGap || null),
    String(payload.prompt || "").trim(),
    now.toISOString(),
    expires.toISOString()
  );
  return { id: probeId, status: "pending", expiresAt: expires.toISOString() };
}

async function expireIfNeeded(row) {
  if (!row || row.status !== "pending") return row;
  if (new Date(row.expires_at).getTime() > Date.now()) return row;
  const db = getDb();
  await db.run(
    `UPDATE probing_sessions SET status = 'accepted', approved_prompt = proposed_prompt, decision_note = 'Auto-accepted after teacher response timeout', decided_at = ? WHERE id = ? AND status = 'pending'`,
    new Date().toISOString(),
    row.id
  );
  return db.get("SELECT * FROM probing_sessions WHERE id = ?", row.id);
}

async function getProbeForStudent(auth, probeId) {
  await ensureTable();
  const db = getDb();
  const row = await db.get("SELECT * FROM probing_sessions WHERE id = ? AND tenant_id = ? AND student_id = ?", probeId, auth.tenant.id, auth.user.id);
  if (!row) throw Object.assign(new Error("Probe tidak ditemukan"), { status: 404 });
  const current = await expireIfNeeded(row);
  return serialize(current);
}

async function listPendingForTeacher(auth) {
  await ensureTable();
  if (!["teacher", "admin"].includes(auth.user.role)) throw Object.assign(new Error("Forbidden"), { status: 403 });
  const db = getDb();
  const rows = await db.all(
    `SELECT p.*, u.name AS student_name, a.topic AS assessment_title, c.name AS class_name
       FROM probing_sessions p
       JOIN users u ON u.id = p.student_id
       JOIN assessments a ON a.id = p.assessment_id AND a.tenant_id = p.tenant_id
       LEFT JOIN classes c ON c.id = p.class_id AND c.tenant_id = p.tenant_id
      WHERE p.tenant_id = ?
        AND p.status = 'pending'
        AND (? = 'admin' OR p.teacher_id = ?)
      ORDER BY p.created_at ASC`,
    auth.tenant.id,
    auth.user.role,
    auth.user.id
  );
  const out = [];
  for (const row of rows) out.push(serialize(await expireIfNeeded(row)));
  return out.filter((row) => row.status === "pending");
}

async function decideProbe(auth, probeId, decision, editedPrompt, note) {
  await ensureTable();
  if (!["teacher", "admin"].includes(auth.user.role)) throw Object.assign(new Error("Forbidden"), { status: 403 });
  if (!["accepted", "skipped", "terminated"].includes(decision)) {
    throw Object.assign(new Error("Keputusan probe tidak valid"), { status: 400 });
  }
  const db = getDb();
  const row = await db.get("SELECT * FROM probing_sessions WHERE id = ? AND tenant_id = ?", probeId, auth.tenant.id);
  if (!row) throw Object.assign(new Error("Probe tidak ditemukan"), { status: 404 });
  if (auth.user.role === "teacher" && row.teacher_id !== auth.user.id) {
    throw Object.assign(new Error("Guru hanya dapat mengelola probe kelasnya"), { status: 403 });
  }
  if (row.status !== "pending") return serialize(row);
  const approvedPrompt = decision === "accepted"
    ? String(editedPrompt || row.proposed_prompt).trim() || row.proposed_prompt
    : null;
  await db.run(
    `UPDATE probing_sessions
        SET status = ?, approved_prompt = ?, decision_note = ?, decided_at = ?
      WHERE id = ? AND tenant_id = ? AND status = 'pending'`,
    decision,
    approvedPrompt,
    String(note || "").trim(),
    new Date().toISOString(),
    probeId,
    auth.tenant.id
  );
  return serialize(await db.get("SELECT * FROM probing_sessions WHERE id = ?", probeId));
}

function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    assessmentId: row.assessment_id,
    classId: row.class_id,
    studentId: row.student_id,
    studentName: row.student_name || null,
    assessmentTitle: row.assessment_title || null,
    className: row.class_name || null,
    questionIndex: Number(row.question_index),
    answer: row.answer || "",
    evidenceGap: row.evidence_gap ? JSON.parse(row.evidence_gap) : null,
    proposedPrompt: row.proposed_prompt,
    approvedPrompt: row.approved_prompt,
    status: row.status,
    decisionNote: row.decision_note || "",
    createdAt: row.created_at,
    decidedAt: row.decided_at,
    expiresAt: row.expires_at,
  };
}

module.exports = { createProbe, getProbeForStudent, listPendingForTeacher, decideProbe };