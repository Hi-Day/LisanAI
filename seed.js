const { getDb, initDatabase } = require('./server/database.js');
const crypto = require('crypto');

function uuid() {
  return crypto.randomUUID();
}

function runQuery(sql, params = []) {
  return getDb().run(sql, ...params);
}

function getQuery(sql, params = []) {
  return getDb().all(sql, ...params);
}

async function seed() {
  await initDatabase();
  console.log("Memulai seeding database...");

  // 0. Bersihkan data lama
  await runQuery("DELETE FROM submissions");
  await runQuery("DELETE FROM assessments");
  await runQuery("DELETE FROM class_memberships");
  await runQuery("DELETE FROM classes");
  await runQuery("DELETE FROM sessions");
  await runQuery("DELETE FROM users");
  await runQuery("DELETE FROM tenants");

  // 1. Dapatkan atau buat tenant default
  let tenants = await getQuery("SELECT id FROM tenants LIMIT 1");
  let tenantId;
  if (tenants.length === 0) {
    tenantId = uuid();
    await runQuery("INSERT INTO tenants (id, name, created_at) VALUES (?, ?, ?)", [
      tenantId,
      "Sekolah Demo",
      new Date().toISOString(),
    ]);
  } else {
    tenantId = tenants[0].id;
  }

  function scrypt(password, salt) {
    return new Promise((resolve, reject) => {
      crypto.scrypt(String(password), salt, 64, (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey.toString("base64url"));
      });
    });
  }
  
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = await scrypt("password123", salt);
  const passwordHash = `scrypt$${salt}$${hash}`;

  // 2. Buat akun Guru dan Siswa
  const teacherId = uuid();
  await runQuery("INSERT INTO users (id, tenant_id, role, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    teacherId, tenantId, "teacher", "Guru Demo", "guru@demo.com", passwordHash, new Date().toISOString()
  ]);

  const student1Id = uuid();
  await runQuery("INSERT INTO users (id, tenant_id, role, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    student1Id, tenantId, "student", "Siswa Budi", "budi@demo.com", passwordHash, new Date().toISOString()
  ]);

  const student2Id = uuid();
  await runQuery("INSERT INTO users (id, tenant_id, role, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    student2Id, tenantId, "student", "Siswa Siti", "siti@demo.com", passwordHash, new Date().toISOString()
  ]);

  // 3. Buat Kelas
  const classId = uuid();
  const joinCode = "DEMO123";
  await runQuery("INSERT INTO classes (id, tenant_id, teacher_id, name, join_code, created_at) VALUES (?, ?, ?, ?, ?, ?)", [
    classId, tenantId, teacherId, "Bahasa Inggris XI", joinCode, new Date().toISOString()
  ]);

  const class2Id = uuid();
  const joinCode2 = "DEMO456";
  await runQuery("INSERT INTO classes (id, tenant_id, teacher_id, name, join_code, created_at) VALUES (?, ?, ?, ?, ?, ?)", [
    class2Id, tenantId, teacherId, "Bahasa Inggris XII", joinCode2, new Date().toISOString()
  ]);

  // 4. Masukkan siswa ke kelas (Memberships)
  await runQuery("INSERT INTO class_memberships (id, tenant_id, class_id, student_id, status, requested_at, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    uuid(), tenantId, classId, student1Id, "approved", new Date().toISOString(), new Date().toISOString()
  ]);
  await runQuery("INSERT INTO class_memberships (id, tenant_id, class_id, student_id, status, requested_at, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    uuid(), tenantId, classId, student2Id, "approved", new Date().toISOString(), new Date().toISOString()
  ]);

  // 5. Buat Assessment
  const assessment1Id = uuid();
  const assessment1Payload = {
    id: assessment1Id,
    tenant_id: tenantId,
    class_id: classId,
    teacher_id: teacherId,
    topic: "Perkenalan Diri (Introduction)",
    difficulty: "Mudah",
    outcomes: "Siswa dapat memperkenalkan diri.",
    rubric: "100% kelancaran",
    status: "published",
    questions: [
      { id: "q1", prompt: "Siapa nama lengkap Anda?", focus: "Nama", ideal: "Nama saya adalah..." },
      { id: "q2", prompt: "Berasal dari mana Anda?", focus: "Asal", ideal: "Saya berasal dari..." }
    ]
  };
  await runQuery("INSERT INTO assessments (id, tenant_id, class_id, teacher_id, status, topic, difficulty, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [
    assessment1Id, tenantId, classId, teacherId, "published", "Perkenalan Diri", "Mudah", JSON.stringify(assessment1Payload), new Date().toISOString()
  ]);

  const assessment2Id = uuid();
  const assessment2Payload = {
    id: assessment2Id,
    tenant_id: tenantId,
    class_id: classId,
    teacher_id: teacherId,
    topic: "Mendeskripsikan Gambar",
    difficulty: "Menengah",
    outcomes: "Siswa dapat menjelaskan situasi.",
    rubric: "50% grammar, 50% kelancaran",
    status: "published",
    questions: [
      { id: "q1", prompt: "Apa yang Anda lihat di gambar ini?", focus: "Deskripsi", ideal: "Saya melihat..." }
    ]
  };
  await runQuery("INSERT INTO assessments (id, tenant_id, class_id, teacher_id, status, topic, difficulty, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [
    assessment2Id, tenantId, classId, teacherId, "published", "Mendeskripsikan Gambar", "Menengah", JSON.stringify(assessment2Payload), new Date().toISOString()
  ]);

  // 6. Buat Submissions (Riwayat Jawaban)
  const sub1Id = uuid();
  const sub1Payload = {
    id: sub1Id,
    tenantId,
    classId,
    assessmentId: assessment1Id,
    studentName: "Siswa Budi",
    assessmentTitle: "Perkenalan Diri (Introduction)",
    finalScore: 85,
    feedback: "Bagus sekali, terus tingkatkan.",
    questionScores: [
      { question: "Siapa nama lengkap Anda?", answer: "Nama saya Budi", score: 90, strengths: ["Jelas"], gaps: [], matched: [] },
      { question: "Berasal dari mana Anda?", answer: "Saya dari Jakarta", score: 80, strengths: ["Tepat"], gaps: [], matched: [] }
    ],
    submittedAt: new Date(Date.now() - 86400000).toISOString() // Kemarin
  };
  await runQuery("INSERT INTO submissions (id, tenant_id, assessment_id, student_name, user_id, final_score, payload, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
    sub1Id, tenantId, assessment1Id, "Siswa Budi", student1Id, 85, JSON.stringify(sub1Payload), sub1Payload.submittedAt
  ]);

  const sub2Id = uuid();
  const sub2Payload = {
    id: sub2Id,
    tenantId,
    classId,
    assessmentId: assessment1Id,
    studentName: "Siswa Siti",
    assessmentTitle: "Perkenalan Diri (Introduction)",
    finalScore: 95,
    feedback: "Sempurna!",
    questionScores: [
      { question: "Siapa nama lengkap Anda?", answer: "Nama saya Siti Aminah", score: 100, strengths: ["Sangat jelas"], gaps: [], matched: [] },
      { question: "Berasal dari mana Anda?", answer: "Saya berasal dari Bandung", score: 90, strengths: ["Bagus"], gaps: [], matched: [] }
    ],
    submittedAt: new Date(Date.now() - 3600000).toISOString() // 1 jam lalu
  };
  await runQuery("INSERT INTO submissions (id, tenant_id, assessment_id, student_name, user_id, final_score, payload, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
    sub2Id, tenantId, assessment1Id, "Siswa Siti", student2Id, 95, JSON.stringify(sub2Payload), sub2Payload.submittedAt
  ]);

  const sub3Id = uuid();
  const sub3Payload = {
    id: sub3Id,
    tenantId,
    classId,
    assessmentId: assessment2Id,
    studentName: "Siswa Budi",
    assessmentTitle: "Mendeskripsikan Gambar",
    finalScore: 75,
    feedback: "Sudah cukup baik, perlu latihan perbendaharaan kata.",
    questionScores: [
      { question: "Apa yang Anda lihat di gambar ini?", answer: "Saya melihat orang sedang bermain", score: 75, strengths: ["Cukup jelas"], gaps: ["Detail kurang"], matched: [] }
    ],
    submittedAt: new Date(Date.now() - 172800000).toISOString() // 2 hari lalu
  };
  await runQuery("INSERT INTO submissions (id, tenant_id, assessment_id, student_name, user_id, final_score, payload, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
    sub3Id, tenantId, assessment2Id, "Siswa Budi", student1Id, 75, JSON.stringify(sub3Payload), sub3Payload.submittedAt
  ]);

  console.log("Seeding selesai!");
  console.log("Gunakan kredensial berikut untuk mencoba:");
  console.log("  Guru  : guru@demo.com / password123");
  console.log("  Siswa : budi@demo.com / password123");
}

seed().catch(console.error);
