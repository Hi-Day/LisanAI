const { test, expect } = require("@playwright/test");
const { ORAL_ID, WRITTEN_ID, loginAsStudent } = require("./seed-assessment");

test.describe("Pre-exam readiness modal", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStudent(page);
    await expect(page.locator("#appShell")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(`.assessment-card[data-id='${WRITTEN_ID}']`)).toBeVisible();
  });

  test("clicking start opens the readiness modal without starting questions or timer", async ({ page }) => {
    await page.click(`.assessment-card[data-id='${ORAL_ID}'] .start-assessment-btn`);
    await expect(page.locator("#preExamModal")).toBeVisible();
    await expect(page.locator("#preExamTitle")).toHaveText("Ujian Lisan E2E");
    await expect(page.locator("#preExamMeta")).toContainText("2 soal");
    await expect(page.locator("#studentWorkspace")).toBeHidden();
    await expect(page.locator("#timerDisplay")).toBeHidden();
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
    await expect(page.locator("#timerDisplay")).toBeVisible();
  });
});
