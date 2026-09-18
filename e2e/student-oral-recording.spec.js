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
  });
});
