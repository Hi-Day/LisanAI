const { loadEnv } = require('./server/config');
loadEnv();
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

  const adminId = uuid();
  await runQuery("INSERT INTO users (id, tenant_id, role, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    adminId, tenantId, "admin", "Admin Observabilitas", "admin@demo.com", passwordHash, new Date().toISOString()
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

  // 6. Siswa Tambahan
  const student3Id = uuid();
  await runQuery("INSERT INTO users (id, tenant_id, role, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    student3Id, tenantId, "student", "Kevin Sanjaya", "kevin@demo.com", passwordHash, new Date().toISOString()
  ]);

  const student4Id = uuid();
  await runQuery("INSERT INTO users (id, tenant_id, role, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    student4Id, tenantId, "student", "Natasha Wilona", "natasha@demo.com", passwordHash, new Date().toISOString()
  ]);

  const student5Id = uuid();
  await runQuery("INSERT INTO users (id, tenant_id, role, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    student5Id, tenantId, "student", "Dian Sastrowardoyo", "dian@demo.com", passwordHash, new Date().toISOString()
  ]);

  // Memberships Siswa Tambahan
  await runQuery("INSERT INTO class_memberships (id, tenant_id, class_id, student_id, status, requested_at, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    uuid(), tenantId, classId, student3Id, "approved", new Date().toISOString(), new Date().toISOString()
  ]);
  await runQuery("INSERT INTO class_memberships (id, tenant_id, class_id, student_id, status, requested_at, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    uuid(), tenantId, classId, student4Id, "approved", new Date().toISOString(), new Date().toISOString()
  ]);
  await runQuery("INSERT INTO class_memberships (id, tenant_id, class_id, student_id, status, requested_at, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    uuid(), tenantId, classId, student5Id, "approved", new Date().toISOString(), new Date().toISOString()
  ]);

  // Submissions Siswa Tambahan
  const sub4Id = uuid();
  const sub4Payload = {
    id: sub4Id,
    tenantId,
    classId,
    assessmentId: assessment1Id,
    studentName: "Kevin Sanjaya",
    assessmentTitle: "Perkenalan Diri (Introduction)",
    finalScore: 88,
    feedback: "Jawaban yang sangat baik dan lancar.",
    questionScores: [
      { question: "Siapa nama lengkap Anda?", answer: "Nama saya Kevin Sanjaya", score: 90, strengths: ["Lancar"], gaps: [], matched: [] },
      { question: "Berasal dari mana Anda?", answer: "Saya dari Jakarta", score: 86, strengths: ["Jelas"], gaps: [], matched: [] }
    ],
    submittedAt: new Date(Date.now() - 7200000).toISOString()
  };
  await runQuery("INSERT INTO submissions (id, tenant_id, assessment_id, student_name, user_id, final_score, payload, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
    sub4Id, tenantId, assessment1Id, "Kevin Sanjaya", student3Id, 88, JSON.stringify(sub4Payload), sub4Payload.submittedAt
  ]);

  const sub5Id = uuid();
  const sub5Payload = {
    id: sub5Id,
    tenantId,
    classId,
    assessmentId: assessment2Id,
    studentName: "Kevin Sanjaya",
    assessmentTitle: "Mendeskripsikan Gambar",
    finalScore: 92,
    feedback: "Luar biasa! Deskripsi sangat mendetail.",
    questionScores: [
      { question: "Apa yang Anda lihat di gambar ini?", answer: "Saya melihat dua orang anak sedang bermain sepak bola di lapangan", score: 92, strengths: ["Sangat detail", "Grammar tepat"], gaps: [], matched: [] }
    ],
    submittedAt: new Date(Date.now() - 3600000).toISOString()
  };
  await runQuery("INSERT INTO submissions (id, tenant_id, assessment_id, student_name, user_id, final_score, payload, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
    sub5Id, tenantId, assessment2Id, "Kevin Sanjaya", student3Id, 92, JSON.stringify(sub5Payload), sub5Payload.submittedAt
  ]);

  const sub6Id = uuid();
  const sub6Payload = {
    id: sub6Id,
    tenantId,
    classId,
    assessmentId: assessment1Id,
    studentName: "Natasha Wilona",
    assessmentTitle: "Perkenalan Diri (Introduction)",
    finalScore: 79,
    feedback: "Sudah baik, coba tingkatkan intonasi dan kelancaran.",
    questionScores: [
      { question: "Siapa nama lengkap Anda?", answer: "Nama saya Natasha Wilona", score: 80, strengths: ["Jelas"], gaps: [], matched: [] },
      { question: "Berasal dari mana Anda?", answer: "Saya dari Bandung", score: 78, strengths: ["Cukup jelas"], gaps: [], matched: [] }
    ],
    submittedAt: new Date(Date.now() - 10800000).toISOString()
  };
  await runQuery("INSERT INTO submissions (id, tenant_id, assessment_id, student_name, user_id, final_score, payload, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
    sub6Id, tenantId, assessment1Id, "Natasha Wilona", student4Id, 79, JSON.stringify(sub6Payload), sub6Payload.submittedAt
  ]);

  const sub7Id = uuid();
  const sub7Payload = {
    id: sub7Id,
    tenantId,
    classId,
    assessmentId: assessment2Id,
    studentName: "Dian Sastrowardoyo",
    assessmentTitle: "Mendeskripsikan Gambar",
    finalScore: 85,
    feedback: "Deskripsi baik dan menggunakan intonasi yang sangat tepat.",
    questionScores: [
      { question: "Apa yang Anda lihat di gambar ini?", answer: "Saya melihat pemandangan gunung dengan sawah hijau di depannya", score: 85, strengths: ["Intonasi bagus", "Diksi tepat"], gaps: [], matched: [] }
    ],
    submittedAt: new Date(Date.now() - 14400000).toISOString()
  };
  await runQuery("INSERT INTO submissions (id, tenant_id, assessment_id, student_name, user_id, final_score, payload, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
    sub7Id, tenantId, assessment2Id, "Dian Sastrowardoyo", student5Id, 85, JSON.stringify(sub7Payload), sub7Payload.submittedAt
  ]);

  // 7. Seed Observability AI Logs
  const logId1 = uuid();
  await runQuery("INSERT INTO ai_logs (id, tenant_id, user_id, action, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, status, cache_savings_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
    logId1, tenantId, teacherId, "recommend_assessment_config", "meta-llama/llama-3.1-8b-instruct", 320, 150, 470, 850, "success", 0, new Date(Date.now() - 3600000 * 24).toISOString()
  ]);

  const logId2 = uuid();
  await runQuery("INSERT INTO ai_logs (id, tenant_id, user_id, action, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, status, cache_savings_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
    logId2, tenantId, teacherId, "generate_questions_with_ai", "google/gemini-2.5-pro", 850, 620, 1470, 2450, "success", 0, new Date(Date.now() - 3600000 * 20).toISOString()
  ]);

  const logId3 = uuid();
  await runQuery("INSERT INTO ai_logs (id, tenant_id, user_id, action, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, status, cache_savings_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
    logId3, tenantId, teacherId, "improve_questions_with_ai", "google/gemini-2.5-pro", 1470, 580, 2050, 1850, "success", 955, new Date(Date.now() - 3600000 * 18).toISOString()
  ]);

  const logId4 = uuid();
  await runQuery("INSERT INTO ai_logs (id, tenant_id, user_id, action, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, status, cache_savings_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
    logId4, tenantId, student1Id, "evaluate_assessment_with_ai", "meta-llama/llama-3.1-70b-instruct", 2100, 450, 2550, 3100, "success", 1365, new Date(Date.now() - 3600000 * 12).toISOString()
  ]);

  const logId5 = uuid();
  await runQuery("INSERT INTO ai_logs (id, tenant_id, user_id, action, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, status, cache_savings_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
    logId5, tenantId, student2Id, "evaluate_assessment_with_ai", "meta-llama/llama-3.1-70b-instruct", 2100, 480, 2580, 2900, "success", 1365, new Date(Date.now() - 3600000 * 8).toISOString()
  ]);

  const logId6 = uuid();
  await runQuery("INSERT INTO ai_logs (id, tenant_id, user_id, action, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, status, cache_savings_tokens, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
    logId6, tenantId, teacherId, "generate_questions_with_ai", "google/gemini-2.5-pro", 0, 0, 0, 520, "error", 0, "OpenRouter API error: Rate limit reached", new Date(Date.now() - 3600000 * 6).toISOString()
  ]);

  const logId7 = uuid();
  await runQuery("INSERT INTO ai_logs (id, tenant_id, user_id, action, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, status, cache_savings_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
    logId7, tenantId, teacherId, "generate_questions_with_ai", "google/gemini-2.5-pro", 850, 590, 1440, 1920, "success", 0, new Date(Date.now() - 3600000 * 5.8).toISOString()
  ]);

  const logId8 = uuid();
  await runQuery("INSERT INTO ai_logs (id, tenant_id, user_id, action, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, status, cache_savings_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
    logId8, tenantId, student3Id, "evaluate_assessment_with_ai", "meta-llama/llama-3.1-70b-instruct", 2100, 460, 2560, 2750, "success", 1365, new Date(Date.now() - 3600000 * 3).toISOString()
  ]);

  const logId9 = uuid();
  await runQuery("INSERT INTO ai_logs (id, tenant_id, user_id, action, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, status, cache_savings_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
    logId9, tenantId, student4Id, "evaluate_assessment_with_ai", "meta-llama/llama-3.1-70b-instruct", 2100, 440, 2540, 3350, "success", 1365, new Date(Date.now() - 3600000 * 2.5).toISOString()
  ]);

  const logId10 = uuid();
  await runQuery("INSERT INTO ai_logs (id, tenant_id, user_id, action, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, status, cache_savings_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
    logId10, tenantId, student5Id, "evaluate_assessment_with_ai", "meta-llama/llama-3.1-70b-instruct", 1200, 410, 1610, 2600, "success", 780, new Date(Date.now() - 3600000 * 1).toISOString()
  ]);

  console.log("Seeding selesai!");
  console.log("Gunakan kredensial berikut untuk mencoba:");
  console.log("  Admin : admin@demo.com / password123");
  console.log("  Guru  : guru@demo.com / password123");
  console.log("  Siswa : budi@demo.com / password123");
}

seed().catch(console.error);
