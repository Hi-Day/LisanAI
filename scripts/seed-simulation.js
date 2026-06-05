const crypto = require("node:crypto");
const { getDb, initDatabase, createClass, requestJoinClass, approveMembership, saveAssessment, saveSubmission } = require("../server/database");

function uid(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function seedSimulationData() {
  await initDatabase();
  const db = getDb();
  console.log("Generating simulation data...");

  // 1. Get Teacher and Student accounts
  const teacher = await db.get("SELECT * FROM users WHERE email = 'guru@oralai.test'");
  const student = await db.get("SELECT * FROM users WHERE email = 'siswa@oralai.test'");

  if (!teacher || !student) {
    console.error("Test accounts not found. Please run seed-accounts.js first.");
    return;
  }

  const tenantId = teacher.tenant_id;
  const authTeacher = { user: teacher, tenant: { id: tenantId } };

  // Clear previous simulation data for this tenant
  console.log("Cleaning up old simulation data...");
  await db.run("DELETE FROM submissions WHERE tenant_id = ?", tenantId);
  await db.run("DELETE FROM assessments WHERE tenant_id = ?", tenantId);
  await db.run("DELETE FROM class_memberships WHERE tenant_id = ?", tenantId);
  await db.run("DELETE FROM classes WHERE tenant_id = ?", tenantId);

  // 2. Create Classes
  console.log("Creating classes...");
  const class1 = await createClass(tenantId, teacher.id, {
    id: uid("cls"),
    name: "Public Speaking Lanjut",
    joinCode: "SPEAK123",
    createdAt: new Date().toISOString()
  });

  const class2 = await createClass(tenantId, teacher.id, {
    id: uid("cls"),
    name: "Bahasa Inggris XI",
    joinCode: "ENG11",
    createdAt: new Date().toISOString()
  });

  // 3. Student joins classes
  console.log("Creating student join requests...");
  const mem1Id = uid("mem");
  await requestJoinClass(tenantId, student.id, "SPEAK123", {
    id: mem1Id,
    requestedAt: new Date().toISOString()
  });

  await requestJoinClass(tenantId, student.id, "ENG11", {
    id: uid("mem"),
    requestedAt: new Date().toISOString()
  });

  // 4. Approve only Class 1 (SPEAK123)
  console.log("Approving membership for Public Speaking Lanjut...");
  await approveMembership(tenantId, teacher.id, mem1Id);

  // 5. Create Assessments
  console.log("Creating assessments...");
  const assessment1 = {
    id: uid("assess"),
    topic: "Job Interview Simulation",
    outcomes: "Siswa mampu menjawab pertanyaan wawancara kerja dasar dengan bahasa Inggris yang jelas, terstruktur, dan percaya diri.",
    rubric: "Kejelasan pengucapan (30%), Struktur Jawaban (40%), Kosa kata (30%).",
    difficulty: "Menengah",
    examples: "Tell me about yourself. Why do you want to work here?",
    classId: class1.id,
    status: "published",
    createdAt: new Date().toISOString(),
    questions: [
      {
        id: uid("q"),
        prompt: "Please introduce yourself briefly and highlight your greatest strength.",
        focus: "Kemampuan mendeskripsikan diri dan kelebihan utama",
        ideal: "I am a hardworking student who enjoys learning new skills. My greatest strength is my adaptability."
      },
      {
        id: uid("q"),
        prompt: "Why should we hire you instead of other candidates?",
        focus: "Kemampuan meyakinkan dan memberikan alasan kuat",
        ideal: "I am highly motivated and learn quickly. I can bring positive energy to the team."
      }
    ]
  };
  await saveAssessment(authTeacher, assessment1);

  const assessment2 = {
    id: uid("assess"),
    topic: "Debate Outline Preparation",
    outcomes: "Siswa mampu menyusun argumen pembuka untuk sesi debat kompetitif.",
    rubric: "Argumen Logis (50%), Struktur Pembukaan (30%), Kosakata Formal (20%).",
    difficulty: "Sulit",
    examples: "The house believes that AI should be regulated.",
    classId: class1.id,
    status: "draft",
    createdAt: new Date().toISOString(),
    questions: [
      {
        id: uid("q"),
        prompt: "What is your opening statement supporting the regulation of AI?",
        focus: "Kekuatan argumen pembuka",
        ideal: "AI presents significant risks if left unchecked, therefore careful regulation is necessary."
      }
    ]
  };
  await saveAssessment(authTeacher, assessment2);

  const assessment3 = {
    id: uid("assess"),
    topic: "Basic Greeting",
    outcomes: "Siswa mampu menyapa dalam bahasa Inggris.",
    rubric: "Pengucapan jelas (100%).",
    difficulty: "Mudah",
    examples: "Hello, good morning.",
    classId: class2.id,
    status: "closed",
    createdAt: new Date().toISOString(),
    questions: [
      {
        id: uid("q"),
        prompt: "How do you greet your teacher in the morning?",
        focus: "Greeting",
        ideal: "Good morning, teacher."
      }
    ]
  };
  await saveAssessment(authTeacher, assessment3);

  // 6. Create Submissions
  console.log("Creating submissions...");
  const submission1 = {
    id: uid("sub"),
    assessmentId: assessment1.id,
    studentName: student.name,
    submittedAt: new Date().toISOString(),
    finalScore: 85,
    questionScores: [
      {
        questionId: assessment1.questions[0].id,
        score: 90,
        feedback: "Pengucapan sangat jelas dan terstruktur dengan baik. Bagus!",
        answer: "I am a very diligent student, and my greatest strength is my adaptability to new situations."
      },
      {
        questionId: assessment1.questions[1].id,
        score: 80,
        feedback: "Alasan sudah cukup baik, namun kosakata bisa lebih ditingkatkan agar lebih persuasif.",
        answer: "You should hire me because I can work well with others."
      }
    ],
    feedback: "Secara keseluruhan, simulasi interview berjalan sangat baik. Pertahankan rasa percaya diri Anda!"
  };
  await saveSubmission(tenantId, student.id, submission1);

  console.log("Simulation data generated successfully! You can now check the app.");
}

seedSimulationData();
