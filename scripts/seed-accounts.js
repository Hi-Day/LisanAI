const { loadEnv } = require("../server/config");
loadEnv();
const crypto = require("node:crypto");
const { getDb, initDatabase, createClass, requestJoinClass, approveMembership, saveAssessment, saveSubmission } = require("../server/database");
const { createTenantUser, registerTenantUser } = require("../server/auth-service");

async function ensureLegacyDemoAccounts(password = "password123") {
  const database = getDb();
  const legacyAccounts = [
    { name: "Admin Demo", email: "admin@demo.com", role: "admin" },
    { name: "Guru Demo", email: "guru@demo.com", role: "teacher" },
    { name: "Budi Demo", email: "budi@demo.com", role: "student" },
  ];

  const tenant = await database.get("SELECT id FROM tenants LIMIT 1");
  if (!tenant) {
    const tenantId = uid("tenant");
    await database.run("INSERT INTO tenants (id, name, plan, created_at) VALUES (?, ?, ?, ?)", tenantId, "Sekolah Demo", "starter", new Date().toISOString());
  }

  const existingTenant = await database.get("SELECT id FROM tenants LIMIT 1");
  const tenantId = existingTenant.id;

  for (const account of legacyAccounts) {
    const existing = await database.get("SELECT id FROM users WHERE email = ?", account.email);
    if (existing) continue;
    await createTenantUser(tenantId, { name: account.name, email: account.email, password, role: account.role });
  }
}

function uid(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function seedTenantData(db, config) {
  const { tenantName, adminEmail, teacherEmail, studentEmail, className, testPassword, assessments } = config;

  // 1. CREATE USERS
  let adminUser;
  try {
    const res = await registerTenantUser({ tenantName, name: "Admin " + tenantName, email: adminEmail, password: testPassword });
    adminUser = res.user;
    console.log(`[${tenantName}] Created Admin:`, adminUser.email);
  } catch (err) {
    if (err.message === "Email sudah terdaftar") {
      adminUser = await db.get("SELECT * FROM users WHERE email = ?", adminEmail);
      console.log(`[${tenantName}] Admin already exists:`, adminUser.email);
    } else return;
  }

  const tenantId = adminUser.tenant_id || adminUser.tenantId;

  let teacher;
  try {
    teacher = await createTenantUser(tenantId, { name: "Guru " + tenantName, email: teacherEmail, password: testPassword, role: "teacher" });
    console.log(`[${tenantName}] Created Teacher:`, teacher.email);
  } catch (err) {
    if (err.message === "Email sudah terdaftar") teacher = await db.get("SELECT * FROM users WHERE email = ?", teacherEmail);
  }
  teacher.id = teacher.id || teacher.user_id;

  let student;
  try {
    student = await createTenantUser(tenantId, { name: "Siswa " + tenantName, email: studentEmail, password: testPassword, role: "student" });
    console.log(`[${tenantName}] Created Student:`, student.email);
  } catch (err) {
    if (err.message === "Email sudah terdaftar") student = await db.get("SELECT * FROM users WHERE email = ?", studentEmail);
  }
  student.id = student.id || student.user_id;

  // 2. CREATE CLASSROOM
  let classroom = await db.get("SELECT * FROM classes WHERE tenant_id = ? AND teacher_id = ?", tenantId, teacher.id);
  if (!classroom) {
    classroom = { id: uid("class"), name: className, joinCode: crypto.randomBytes(4).toString("hex").toUpperCase(), createdAt: new Date().toISOString() };
    await createClass(tenantId, teacher.id, classroom);
    console.log(`[${tenantName}] Created Classroom:`, classroom.name);
  } else {
    classroom.joinCode = classroom.join_code;
    console.log(`[${tenantName}] Classroom already exists:`, classroom.name);
  }

  // 3. CREATE MEMBERSHIP
  let membership = await db.get("SELECT * FROM class_memberships WHERE class_id = ? AND student_id = ?", classroom.id, student.id);
  if (!membership) {
    const memId = uid("member");
    await requestJoinClass(tenantId, student.id, classroom.joinCode, { id: memId, requestedAt: new Date().toISOString() });
    await approveMembership(tenantId, teacher.id, memId);
    console.log(`[${tenantName}] Created and approved Membership for Student`);
  } else {
    console.log(`[${tenantName}] Membership already exists`);
  }

  // 4. CREATE ASSESSMENTS & SUBMISSIONS
  const authTeacher = { tenant: { id: tenantId }, user: { id: teacher.id, role: "teacher" } };

  for (const aConfig of assessments) {
    const assessment = {
      id: aConfig.id,
      classId: classroom.id,
      topic: aConfig.topic,
      difficulty: aConfig.difficulty || "Menengah",
      status: "published",
      outcomes: aConfig.outcomes,
      rubric: aConfig.rubric,
      timeLimit: aConfig.timeLimit !== undefined ? aConfig.timeLimit : 0,
      createdAt: aConfig.createdAt || new Date().toISOString(),
      questions: aConfig.questions
    };
    await saveAssessment(authTeacher, assessment);
    console.log(`[${tenantName}] Seeded Assessment: ${assessment.topic}`);

    if (aConfig.submission) {
      let submission = await db.get("SELECT * FROM submissions WHERE assessment_id = ? AND user_id = ?", aConfig.id, student.id);
      if (!submission) {
        const sub = {
          id: uid("submission"),
          assessmentId: aConfig.id,
          studentName: student.name,
          finalScore: aConfig.submission.finalScore,
          submittedAt: aConfig.submission.submittedAt || new Date().toISOString(),
          questionScores: aConfig.submission.questionScores,
          feedback: aConfig.submission.feedback
        };
        await saveSubmission(tenantId, student.id, sub);
        console.log(`[${tenantName}] Created Submission for: ${assessment.topic}`);
      }
    }
  }

  // 5. Seed Observability AI Logs
  const logCheck = await db.get("SELECT COUNT(*) as count FROM ai_logs WHERE tenant_id = ?", tenantId);
  if (logCheck.count === 0) {
    const logId1 = uid("log");
    await db.run("INSERT INTO ai_logs (id, tenant_id, user_id, action, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, status, cache_savings_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
      logId1, tenantId, teacher.id, "recommend_assessment_config", "meta-llama/llama-3.1-8b-instruct", 320, 150, 470, 850, "success", 0, new Date(Date.now() - 3600000 * 24).toISOString()
    ]);

    const logId2 = uid("log");
    await db.run("INSERT INTO ai_logs (id, tenant_id, user_id, action, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, status, cache_savings_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
      logId2, tenantId, teacher.id, "generate_questions_with_ai", "google/gemini-2.5-pro", 850, 620, 1470, 2450, "success", 0, new Date(Date.now() - 3600000 * 20).toISOString()
    ]);

    const logId3 = uid("log");
    await db.run("INSERT INTO ai_logs (id, tenant_id, user_id, action, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, status, cache_savings_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
      logId3, tenantId, teacher.id, "improve_questions_with_ai", "google/gemini-2.5-pro", 1470, 580, 2050, 1850, "success", 955, new Date(Date.now() - 3600000 * 18).toISOString()
    ]);

    const logId4 = uid("log");
    await db.run("INSERT INTO ai_logs (id, tenant_id, user_id, action, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, status, cache_savings_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
      logId4, tenantId, student.id, "evaluate_assessment_with_ai", "meta-llama/llama-3.1-70b-instruct", 2100, 450, 2550, 3100, "success", 1365, new Date(Date.now() - 3600000 * 12).toISOString()
    ]);

    const logId5 = uid("log");
    await db.run("INSERT INTO ai_logs (id, tenant_id, user_id, action, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, status, cache_savings_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
      logId5, tenantId, student.id, "evaluate_assessment_with_ai", "meta-llama/llama-3.1-70b-instruct", 2100, 480, 2580, 2900, "success", 1365, new Date(Date.now() - 3600000 * 8).toISOString()
    ]);

    const logId6 = uid("log");
    await db.run("INSERT INTO ai_logs (id, tenant_id, user_id, action, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, status, cache_savings_tokens, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
      logId6, tenantId, teacher.id, "generate_questions_with_ai", "google/gemini-2.5-pro", 0, 0, 0, 520, "error", 0, "OpenRouter API error: Rate limit reached", new Date(Date.now() - 3600000 * 6).toISOString()
    ]);

    console.log(`[${tenantName}] Seeded Observability Logs`);
  }
}

async function seedTestAccounts() {
  await initDatabase();
  const db = getDb();
  console.log("Seeding multi-tenant demo data...");

  const testPassword = "password123";
  
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // TENANT 1: Demo School
  await seedTenantData(db, {
    tenantName: "Demo School",
    adminEmail: "admin@lisan.ai",
    teacherEmail: "guru@lisan.ai",
    studentEmail: "siswa@lisan.ai",
    className: "Kelas Bahasa Inggris X-A",
    testPassword,
    assessments: [
      {
        id: "assess-seed-week1",
        topic: "Minggu 1: Perkenalan Diri",
        difficulty: "Pemula",
        outcomes: "Siswa mampu memperkenalkan diri dalam bahasa Inggris dasar.",
        rubric: "Kejelasan: 50%, Kosa Kata: 50%",
        createdAt: new Date(now - 20 * dayMs).toISOString(),
        questions: [
          { id: "q-w1-1", prompt: "What is your name?", focus: "identity", ideal: "I am [Name]." },
          { id: "q-w1-2", prompt: "Where do you live?", focus: "location", ideal: "I live in [City]." }
        ],
        submission: {
          finalScore: 65,
          submittedAt: new Date(now - 19 * dayMs).toISOString(),
          questionScores: [
            { question: "What is your name?", answer: "Me name is Budi.", score: 60, strengths: [], gaps: ["Grammar error (Me -> My)"] },
            { question: "Where do you live?", answer: "I living in Jakarta.", score: 70, strengths: ["Correct city"], gaps: ["Grammar error (living -> live)"] }
          ],
          feedback: "Awal yang baik, tapi perlu diperhatikan penggunaan grammar dasar."
        }
      },
      {
        id: "assess-seed-week2",
        topic: "Minggu 2: Hobi dan Minat",
        difficulty: "Pemula",
        outcomes: "Siswa mampu menceritakan hobi dan aktivitas kesukaan.",
        rubric: "Kelancaran: 50%, Kosa Kata: 50%",
        createdAt: new Date(now - 14 * dayMs).toISOString(),
        questions: [
          { id: "q-w2-1", prompt: "What are your hobbies?", focus: "hobbies", ideal: "My hobbies are [Hobby 1] and [Hobby 2]." },
          { id: "q-w2-2", prompt: "Why do you like it?", focus: "reason", ideal: "I like it because [Reason]." }
        ],
        submission: {
          finalScore: 78,
          submittedAt: new Date(now - 13 * dayMs).toISOString(),
          questionScores: [
            { question: "What are your hobbies?", answer: "My hobbies are reading and swimming.", score: 85, strengths: ["Good vocabulary"], gaps: [] },
            { question: "Why do you like it?", answer: "Because it make me happy.", score: 70, strengths: ["Clear reason"], gaps: ["Grammar error (make -> makes)"] }
          ],
          feedback: "Kemajuan yang bagus. Kosa kata sudah bertambah. Latih subjek dan kata kerja."
        }
      },
      {
        id: "assess-seed-week3",
        topic: "Minggu 3: Pengalaman Liburan",
        difficulty: "Menengah",
        outcomes: "Siswa mampu menceritakan pengalaman masa lalu menggunakan past tense.",
        rubric: "Past Tense: 40%, Kelancaran: 40%, Kosa Kata: 20%",
        createdAt: new Date(now - 7 * dayMs).toISOString(),
        questions: [
          { id: "q-w3-1", prompt: "Where did you go for your last holiday?", focus: "destination", ideal: "I went to [Place]." },
          { id: "q-w3-2", prompt: "What did you do there?", focus: "activities", ideal: "I visited [Place] and ate [Food]." },
          { id: "q-w3-3", prompt: "Did you enjoy it? Why?", focus: "feeling", ideal: "Yes, I enjoyed it because it was fun." }
        ],
        submission: {
          finalScore: 88,
          submittedAt: new Date(now - 5 * dayMs).toISOString(),
          questionScores: [
            { question: "Where did you go for your last holiday?", answer: "I went to Bali with my family.", score: 95, strengths: ["Correct past tense", "Good detail"], gaps: [] },
            { question: "What did you do there?", answer: "I swam at the beach and ate seafood.", score: 90, strengths: ["Clear activities", "Correct verbs"], gaps: [] },
            { question: "Did you enjoy it? Why?", answer: "Yes, because the beach is beautiful.", score: 80, strengths: ["Good reasoning"], gaps: ["Could use past tense (was beautiful)"] }
          ],
          feedback: "Pemahaman past tense sudah sangat baik. Percaya diri saat berbicara sudah meningkat."
        }
      },
      {
        id: "assess-seed-unanswered",
        topic: "Minggu 4: Rencana Masa Depan",
        difficulty: "Lanjut",
        timeLimit: 60,
        outcomes: "Siswa mampu menjelaskan rencana masa depan menggunakan future tense.",
        rubric: "Future Tense: 50%, Kosa Kata: 50%",
        createdAt: new Date().toISOString(),
        questions: [
          { id: "q-w4-1", prompt: "What will you do after graduation?", focus: "plan", ideal: "I will [Action]." }
        ]
      }
    ]
  });

  // TENANT 2: SMA Bina Nusantara
  await seedTenantData(db, {
    tenantName: "SMA Bina Nusantara",
    adminEmail: "admin.binus@lisan.ai",
    teacherEmail: "guru.binus@lisan.ai",
    studentEmail: "siswa.binus@lisan.ai",
    className: "Kelas Bahasa Indonesia XI-IPA",
    testPassword,
    assessments: [
      {
        id: "assess-seed-pidato",
        topic: "Pembukaan Pidato Persuasif",
        outcomes: "Siswa mampu menyusun dan melafalkan pembukaan pidato dengan intonasi tepat.",
        rubric: "Intonasi: 40%, Diksi: 40%, Artikulasi: 20%",
        createdAt: new Date(now - 10 * dayMs).toISOString(),
        questions: [
          { id: "q-seed-pidato-1", prompt: "Sampaikan salam pembuka dan sapaan penghormatan kepada hadirin.", focus: "salam", ideal: "Assalamu'alaikum/Selamat pagi..." },
          { id: "q-seed-pidato-2", prompt: "Sampaikan kalimat ucapan syukur sebagai pengantar pidato.", focus: "syukur", ideal: "Pertama-tama marilah kita panjatkan puji syukur..." }
        ],
        submission: {
          finalScore: 82,
          submittedAt: new Date(now - 9 * dayMs).toISOString(),
          questionScores: [
            { question: "Sampaikan salam pembuka...", answer: "Selamat pagi semuanya yang terhormat.", score: 80, strengths: ["Jelas"], gaps: ["Kurang formal"] },
            { question: "Sampaikan kalimat ucapan syukur...", answer: "Mari kita bersyukur kepada Tuhan.", score: 85, strengths: ["Intonasi baik"], gaps: [] }
          ],
          feedback: "Cukup baik, tapi perhatikan pemilihan kata agar lebih formal."
        }
      },
      {
        id: "assess-seed-argumentasi",
        topic: "Debat: Dampak Sosial Media",
        outcomes: "Siswa mampu memberikan pendapat yang logis dan menyanggah argumen dengan santun.",
        rubric: "Logika: 50%, Kesantunan Berbahasa: 30%, Kosa Kata: 20%",
        createdAt: new Date(now - 2 * dayMs).toISOString(),
        questions: [
          { id: "q-seed-debat-1", prompt: "Apa pendapat utama Anda mengenai penggunaan sosial media pada anak di bawah umur?", focus: "opini", ideal: "Menurut saya..." },
          { id: "q-seed-debat-2", prompt: "Bagaimana cara mencegah dampak negatifnya?", focus: "solusi", ideal: "Cara mencegahnya adalah..." }
        ],
        submission: {
          finalScore: 92,
          submittedAt: new Date(now - 1 * dayMs).toISOString(),
          questionScores: [
            { question: "Apa pendapat utama Anda...", answer: "Menurut saya sebaiknya dilarang karena banyak konten tidak mendidik.", score: 95, strengths: ["Opini jelas", "Alasan logis"], gaps: [] },
            { question: "Bagaimana cara mencegah...", answer: "Orang tua harus mengawasi anak-anaknya terus.", score: 89, strengths: ["Solusi relevan"], gaps: ["Diksi 'terus' bisa diganti 'secara berkala'"] }
          ],
          feedback: "Kemampuan argumentasi sudah sangat bagus. Pemilihan kata cukup baik."
        }
      }
    ]
  });

  await ensureLegacyDemoAccounts(testPassword);
  console.log("Done seeding multi-tenant demo data!");
}

if (require.main === module) {
  seedTestAccounts();
}

module.exports = {
  ensureLegacyDemoAccounts,
};
