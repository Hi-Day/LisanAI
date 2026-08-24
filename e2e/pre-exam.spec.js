const { test, expect } = require("@playwright/test");

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

test.describe("Pre-exam readiness modal", () => {
  test.beforeAll(async ({ request }) => {
    const login = await request.post("/api/auth", {
      data: { action: "login", payload: { email: "e2e.guru@example.com", password: "password123" } },
    });
    expect(login.ok()).toBeTruthy();
    const { csrfToken } = await login.json();

    for (const payload of [
      assessmentPayload(ORAL_ID, "Ujian Lisan E2E", true),
      assessmentPayload(WRITTEN_ID, "Ujian Tulis E2E", false),
    ]) {
      const saved = await request.post("/api/database", {
        headers: { "X-CSRF-Token": csrfToken },
        data: { action: "save-assessment", payload },
      });
      expect(saved.ok()).toBeTruthy();
    }
    await request.post("/api/auth", {
      headers: { "X-CSRF-Token": csrfToken },
      data: { action: "logout" },
    });
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.fill("#loginEmail", "e2e.siswa@example.com");
    await page.fill("#loginPassword", "password123");
    await page.click("#loginForm button[type='submit']");
    await expect(page.locator("#appShell")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(`.assessment-card[data-id='${WRITTEN_ID}']`)).toBeVisible();
  });

  test("clicking start opens the readiness modal without starting questions or timer", async ({ page }) => {
    await page.click(`.assessment-card[data-id='${ORAL_ID}'] .start-assessment-btn`);

    await expect(page.locator("#preExamModal")).toBeVisible();
    await expect(page.locator("#preExamTitle")).toHaveText("Ujian Lisan E2E");
    await expect(page.locator("#preExamMeta")).toContainText("2 soal");
    // Ujian belum jalan: workspace dan timer masih tersembunyi.
    await expect(page.locator("#studentWorkspace")).toBeHidden();
    await expect(page.locator("#timerDisplay")).toBeHidden();
    // Ujian lisan: mic wajib dites dulu sebelum tombol mulai aktif.
    await expect(page.locator("#preExamMicSection")).toBeVisible();
    await expect(page.locator("#preExamStart")).toBeDisabled();
  });

  test("closing the modal keeps the student on the dashboard", async ({ page }) => {
    await page.click(`.assessment-card[data-id='${ORAL_ID}'] .start-assessment-btn`);
    await expect(page.locator("#preExamModal")).toBeVisible();

    await page.click("#preExamCancel");
    await expect(page.locator("#preExamModal")).toBeHidden();
    await expect(page.locator("#studentDashboard")).toBeVisible();
    await expect(page.locator("#studentWorkspace")).toBeHidden();
  });

  test("non-oral assessment can start straight from the modal button", async ({ page }) => {
    await page.click(`.assessment-card[data-id='${WRITTEN_ID}'] .start-assessment-btn`);
    await expect(page.locator("#preExamMicSection")).toBeHidden();
    await expect(page.locator("#preExamStart")).toBeEnabled();

    await page.click("#preExamStart");
    await expect(page.locator("#preExamModal")).toBeHidden();
    await expect(page.locator("#studentWorkspace")).toBeVisible();
    await expect(page.locator("#activeQuestion")).toHaveText("Apa itu fotosintesis?");
    // Timer baru berjalan setelah tombol mulai ditekan.
    await expect(page.locator("#timerDisplay")).toBeVisible();
  });
  test.describe("with a fake microphone", () => {
    test.use({
      permissions: ["microphone"],
      launchOptions: {
        args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
      },
    });

    test("mic test unlocks the start button and records a playback sample", async ({ page }) => {
      await page.click(`.assessment-card[data-id='${ORAL_ID}'] .start-assessment-btn`);
      await expect(page.locator("#preExamStart")).toBeDisabled();

      await page.click("#preExamMicTest");
      await expect(page.locator("#preExamMicStatus")).toHaveText("✓ Mikrofon siap", { timeout: 20_000 });
      await expect(page.locator("#preExamPlayback")).toBeVisible();
      await expect(page.locator("#preExamStart")).toBeEnabled();

      await page.click("#preExamStart");
      await expect(page.locator("#studentWorkspace")).toBeVisible();
      await expect(page.locator("#timerDisplay")).toBeVisible();
    });
  });
});
