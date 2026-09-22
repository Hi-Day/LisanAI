const { test, expect } = require("@playwright/test");
const { ORAL_ID, loginAsStudent } = require("./seed-assessment");

// Mikrofon palsu Chromium: getUserMedia berhasil dan mengeluarkan nada uji.
test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  },
});

test.describe("Student oral recording flow", () => {
  test("student records an oral answer and receives an evaluation", async ({ page }) => {
    const dbRequests = [];
    page.on("request", (request) => {
      if (!request.url().includes("/api/database")) return;
      const post = request.postData() || "";
      let action = null;
      try { action = JSON.parse(post).action; } catch { /* ignore */ }
      dbRequests.push({ action, hasAudio: post.includes("data:audio") });
    });

    await loginAsStudent(page);
    await expect(page.locator("#appShell")).toBeVisible({ timeout: 10_000 });
    await page.click(`.assessment-card[data-id='${ORAL_ID}'] .start-assessment-btn`);

    // Pre-exam: mikrofon harus siap sebelum penilaian bisa dimulai.
    await page.click("#preExamMicTest");
    await expect(page.locator("#preExamMicStatus")).toHaveText("✓ Mikrofon siap", { timeout: 20_000 });
    await page.click("#preExamStart");

    await expect(page.locator("#studentWorkspace")).toBeVisible();
    await expect(page.locator("#recorderPanel")).toBeVisible();
    await expect(page.locator("#activeQuestion")).toBeVisible();

    // Mulai merekam: label tombol berubah setelah persiapan async.
    const recordButton = page.locator("#recordButton");
    const recordLabel = page.locator("#recordButton .record-label");
    await expect(recordButton).toBeEnabled();
    // Pinning: rekaman bersifat user-initiated. Sebelum tombol diklik, tidak
    // boleh ada rekaman otomatis yang sudah berjalan.
    await expect(page.locator("#recordStatus")).toHaveText("Siap merekam");
    await expect(recordButton).toHaveAttribute("aria-label", "Mulai rekam");
    // Mulai merekam: tombol masuk keadaan merekam setelah persiapan async.
    await recordButton.click();
    await expect(recordButton).toHaveAttribute("aria-label", "Berhenti rekam", { timeout: 15_000 });
    await expect(recordLabel).toHaveText("Berhenti", { timeout: 15_000 });
    await expect(page.locator("#recordStatus")).toContainText("Merekam", { timeout: 15_000 });

    // Biarkan perangkat audio palsu merekam beberapa saat.
    await page.waitForTimeout(2000);

    // Berhenti merekam: tombol kembali ke keadaan awal dan audio tersimpan di memori.
    await recordButton.click();
    await expect(recordButton).toHaveAttribute("aria-label", "Mulai rekam", { timeout: 15_000 });
    await expect(recordLabel).toHaveText("Mulai rekam", { timeout: 15_000 });
    await expect(page.locator("#recordStatus")).toContainText("Audio berhasil direkam", { timeout: 15_000 });

    // Di bawah flag media palsu transkripsi bisa kosong, jadi ketik jawaban secara manual.
    await page.fill("#answerText", "Fotosintesis adalah proses tumbuhan menggunakan cahaya untuk menghasilkan energi kimia.");
    await page.click("#saveAnswer");

    await expect(page.locator("#activeQuestion")).toContainText("Pertanyaan lanjutan", { timeout: 20_000 });
    await expect(page.locator("#answerText")).toBeEditable();

    await page.fill("#answerText", "Karena cahaya menyediakan energi yang diperlukan untuk berlangsungnya fotosintesis.");
    await page.click("#finishAssessment");
    await expect(page.locator("#confirmModal")).toBeVisible();
    await page.click("#confirmModalOk");
    await expect(page.locator("#evaluationLoadingModal")).toBeHidden({ timeout: 30_000 });
    await expect(page.locator("#resultPanel")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("#resultPanel")).toContainText("Skor akhir");

    // Regression: the main submission must not carry base64 audio; audio is
    // uploaded separately, and the evidence-feedback write must not erase it.
    const saveRequest = dbRequests.find((item) => item.action === "save-submission");
    expect(saveRequest, "main save-submission request captured").toBeTruthy();
    expect(saveRequest.hasAudio).toBe(false);
    const audioRequest = dbRequests.find((item) => item.action === "save-submission-audio");
    expect(audioRequest, "audio upload request captured").toBeTruthy();
    expect(audioRequest.hasAudio).toBe(true);

    await expect
      .poll(async () => page.evaluate(async (oralId) => {
        const response = await fetch("/api/state", { credentials: "include" });
        const state = await response.json();
        const submission = (state.submissions || []).filter((item) => item.assessmentId === oralId).pop();
        return submission ? (submission.questionScores || []).some((q) => q.hasAudio === true) : false;
      }, ORAL_ID), { timeout: 20_000 })
      .toBe(true);
  });
});
