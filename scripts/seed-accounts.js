const { loadEnv } = require("../server/config");
loadEnv();
const crypto = require("node:crypto");
const { getDb, initDatabase, createClass, requestJoinClass, approveMembership, saveAssessment, saveSubmission } = require("../server/database");
const { createTenantUser, registerTenantUser } = require("../server/auth-service");

function uid(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function seedTestAccounts() {
  await initDatabase();
  const db = getDb();
  console.log("Seeding full demo data...");

  const testPassword = "password123";

  // 1. CREATE USERS
  let adminUser;
  try {
    const res = await registerTenantUser({
      tenantName: "Demo School",
      name: "Admin Demo",
      email: "admin@oralai.test",
      password: testPassword,
    });
    adminUser = res.user;
    console.log("Created Admin account:", adminUser.email);
  } catch (err) {
    if (err.message === "Email sudah terdaftar") {
      adminUser = await db.get("SELECT * FROM users WHERE email = ?", "admin@oralai.test");
      console.log("Admin account already exists:", adminUser.email);
    } else {
      console.error("Error creating admin:", err);
      return;
    }
  }

  const tenantId = adminUser.tenant_id || adminUser.tenantId;

  let teacher;
  try {
    teacher = await createTenantUser(tenantId, {
      name: "Guru Demo",
      email: "guru@oralai.test",
      password: testPassword,
      role: "teacher"
    });
    console.log("Created Teacher account:", teacher.email);
  } catch (err) {
    if (err.message === "Email sudah terdaftar") {
      teacher = await db.get("SELECT * FROM users WHERE email = ?", "guru@oralai.test");
      console.log("Teacher account already exists:", teacher.email);
    }
  }
  teacher.id = teacher.id || teacher.user_id;

  let student;
  try {
    student = await createTenantUser(tenantId, {
      name: "Siswa Demo",
      email: "siswa@oralai.test",
      password: testPassword,
      role: "student"
    });
    console.log("Created Student account:", student.email);
  } catch (err) {
    if (err.message === "Email sudah terdaftar") {
      student = await db.get("SELECT * FROM users WHERE email = ?", "siswa@oralai.test");
      console.log("Student account already exists:", student.email);
    }
  }
  student.id = student.id || student.user_id;

  // 2. CREATE CLASSROOM
  let classroom = await db.get("SELECT * FROM classes WHERE tenant_id = ? AND teacher_id = ?", tenantId, teacher.id);
  if (!classroom) {
    classroom = {
      id: uid("class"),
      name: "Kelas Bahasa Inggris X-A",
      joinCode: crypto.randomBytes(4).toString("hex").toUpperCase(),
      createdAt: new Date().toISOString()
    };
    await createClass(tenantId, teacher.id, classroom);
    console.log("Created Classroom:", classroom.name);
  } else {
    classroom.joinCode = classroom.join_code;
    console.log("Classroom already exists:", classroom.name);
  }

  // 3. CREATE MEMBERSHIP
  let membership = await db.get("SELECT * FROM class_memberships WHERE class_id = ? AND student_id = ?", classroom.id, student.id);
  if (!membership) {
    const memId = uid("member");
    await requestJoinClass(tenantId, student.id, classroom.joinCode, { id: memId, requestedAt: new Date().toISOString() });
    await approveMembership(tenantId, teacher.id, memId);
    console.log("Created and approved Membership for Student in Class");
  } else {
    console.log("Membership already exists");
  }

  // 4. CREATE ASSESSMENTS
  const authTeacher = { tenant: { id: tenantId }, user: { id: teacher.id, role: "teacher" } };

  // Assessment 1: Unanswered
  let assessment1 = await db.get("SELECT * FROM assessments WHERE topic = ?", "Perkenalan Diri (Bahasa Inggris)");
  if (!assessment1) {
    const a1 = {
      id: uid("assessment"),
      classId: classroom.id,
      topic: "Perkenalan Diri (Bahasa Inggris)",
      difficulty: "Pemula",
      status: "published",
      outcomes: "Siswa mampu memperkenalkan diri dalam bahasa Inggris dasar.",
      rubric: "Kejelasan: 50%, Kosa Kata: 50%",
      timeLimit: 60,
      createdAt: new Date().toISOString(),
      questions: [
        { id: uid("q"), prompt: "What is your name and where do you live?", focus: "identity", ideal: "I am [Name] and I live in [City]." },
        { id: uid("q"), prompt: "What are your hobbies?", focus: "hobby", ideal: "My hobbies are [Hobby 1] and [Hobby 2]." }
      ]
    };
    await saveAssessment(authTeacher, a1);
    console.log("Created Unanswered Assessment 1");
  } else {
    console.log("Unanswered Assessment 1 already exists");
  }

  // Assessment 2: Answered
  let assessment2 = await db.get("SELECT * FROM assessments WHERE topic = ?", "Pengalaman Liburan (Bahasa Inggris)");
  let a2Id = assessment2 ? assessment2.id : uid("assessment");
  if (!assessment2) {
    const a2 = {
      id: a2Id,
      classId: classroom.id,
      topic: "Pengalaman Liburan (Bahasa Inggris)",
      difficulty: "Menengah",
      status: "published",
      outcomes: "Siswa mampu menceritakan pengalaman masa lalu menggunakan past tense.",
      rubric: "Past Tense: 40%, Kelancaran: 40%, Kosa Kata: 20%",
      timeLimit: 0,
      createdAt: new Date().toISOString(),
      questions: [
        { id: uid("q"), prompt: "Where did you go for your last holiday?", focus: "destination", ideal: "I went to [Place]." },
        { id: uid("q"), prompt: "What did you do there?", focus: "activities", ideal: "I visited [Place] and ate [Food]." },
        { id: uid("q"), prompt: "Did you enjoy it? Why?", focus: "feeling", ideal: "Yes, I enjoyed it because it was fun." }
      ]
    };
    await saveAssessment(authTeacher, a2);
    console.log("Created Answered Assessment 2");
  } else {
    console.log("Answered Assessment 2 already exists");
  }

  // 5. CREATE SUBMISSION
  let submission = await db.get("SELECT * FROM submissions WHERE assessment_id = ? AND user_id = ?", a2Id, student.id);
  if (!submission) {
    const sub = {
      id: uid("submission"),
      assessmentId: a2Id,
      studentName: student.name,
      finalScore: 85,
      submittedAt: new Date().toISOString(),
      questionScores: [
        { question: "Where did you go for your last holiday?", answer: "I went to Bali.", score: 90, strengths: ["Correct past tense"], gaps: [] },
        { question: "What did you do there?", answer: "I go to the beach.", score: 70, strengths: ["Clear vocabulary"], gaps: ["Used present tense instead of past tense"] },
        { question: "Did you enjoy it? Why?", answer: "Yes, because the beach is beautiful.", score: 95, strengths: ["Good reasoning"], gaps: [] }
      ],
      feedback: "Pemahaman past tense sudah cukup baik, perlu sedikit latihan pada kata kerja tidak beraturan."
    };
    await saveSubmission(tenantId, student.id, sub);
    console.log("Created Submission for Assessment 2 by Student");
  } else {
    console.log("Submission already exists");
  }

  console.log("Done seeding full demo data!");
}

seedTestAccounts();
