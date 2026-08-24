const { test, expect } = require("@playwright/test");
const { ORAL_ID, assessmentPayload, seedAssessments, loginAsStudent } = require("./seed-assessment");

// Mikrofon palsu Chromium: getUserMedia berhasil dan mengeluarkan nada uji.
test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  },
});

test.describe("Pre-exam mic test", () => {
  test.beforeAll(async ({ request }) => {
    await seedAssessments(request, [assessmentPayload(ORAL_ID, "Ujian Lisan E2E", true)]);
  });

  test("mic test unlocks the start button and records a playback sample", async ({ page }) => {
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
  });
});
