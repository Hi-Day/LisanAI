/** Data penilaian bersama untuk spec E2E (dipakai juga oleh e2e/server.js saat seeding). */
const ORAL_ID = "e2e-assess-oral";
const WRITTEN_ID = "e2e-assess-written";

function assessmentPayload(id, topic, oralExamEnabled) {
  return {
    id,
    topic,
    outcomes: "Siswa mampu menjelaskan konsep dasar.",
    rubric: "Ketepatan konsep 60%, kejelasan 40%.",
    difficulty: "Menengah",
    examples: "",
    classId: "e2e-class-1",
    status: "published",
    timeLimit: 60,
    oralExamEnabled,
    disableManualTyping: false,
    allowRetakes: true,
    maxAttempts: 0,
    createdAt: new Date().toISOString(),
    questions: [
      { prompt: "Apa itu fotosintesis?", focus: "konsep", rubric: "Sebut reaktan dan produk." },
      { prompt: "Mengapa cahaya penting?", focus: "sebab-akibat", rubric: "Hubungkan energi dan glukosa." },
    ],
  };
}

/** Login siswa E2E. Dipanggil sekali per spec agar tidak menabrak rate limit login. */
async function loginAsStudent(page) {
  await page.goto("/");
  await page.fill("#loginEmail", "e2e.siswa@example.com");
  await page.fill("#loginPassword", "password123");
  await page.click("#loginForm button[type='submit']");
}

module.exports = { ORAL_ID, WRITTEN_ID, assessmentPayload, loginAsStudent };
