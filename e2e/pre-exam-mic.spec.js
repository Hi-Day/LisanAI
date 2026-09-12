const { test, expect } = require("@playwright/test");
const { ORAL_ID, loginAsStudent } = require("./seed-assessment");

// Mikrofon palsu Chromium: getUserMedia berhasil dan mengeluarkan nada uji.
test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  },
});

test.describe("Pre-exam mic and oral probing", () => {
  test("mic test unlocks the start button and oral assessment can enter probing", async ({ page }) => {
    await loginAsStudent(page);
    await expect(page.locator("#appShell")).toBeVisible({ timeout: 10_000 });
    await page.click(`.assessment-card[data-id='${ORAL_ID}'] .start-assessment-btn`);
    await expect(page.locator("#preExamStart")).toBeDisabled();

    await page.click("#preExamMicTest");
    await expect(page.locator("#preExamMicStatus")).toHaveText("✓ Mikrofon siap", { timeout: 20_000 });
    await expect(page.locator("#preExamPlayback")).toBeVisible();
    await expect(page.locator("#preExamStart")).toBeEnabled();

    await page.click("#preExamStart");
    await expect(page.locator("#studentWorkspace")).toBeVisible();
    await expect(page.locator("#timerDisplay")).toBeVisible();

    await page.fill("#answerText", "Fotosintesis adalah proses tumbuhan menggunakan cahaya untuk menghasilkan energi kimia.");
    await page.click("#saveAnswer");

    await expect(page.locator("#activeQuestion")).toContainText("Pertanyaan lanjutan", { timeout: 20_000 });
    await expect(page.locator("#activeQuestion")).toContainText("?");
    await expect(page.locator("#answerText")).toBeEditable();

    await page.fill("#answerText", "Karena cahaya menyediakan energi yang diperlukan untuk berlangsungnya fotosintesis.");
    await page.click("#finishAssessment");
    await expect(page.locator("#confirmModal")).toBeVisible();
    await page.click("#confirmModalOk");
    await expect(page.locator("#evaluationLoadingModal")).toBeHidden({ timeout: 30_000 });
    await expect(page.locator("#resultPanel")).toBeVisible({ timeout: 10_000 });
  });
});
