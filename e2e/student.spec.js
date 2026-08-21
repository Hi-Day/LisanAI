const { test, expect } = require("@playwright/test");

test.describe("Student assessment flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.fill("#loginEmail", "e2e.siswa@example.com");
    await page.fill("#loginPassword", "password123");
    await page.click("#loginForm button[type='submit']");
    await expect(page.locator("#appShell")).toBeVisible({ timeout: 10_000 });
  });

  test("student sees the student dashboard with their class", async ({ page }) => {
    await expect(page.locator("#studentView")).toBeVisible();
    await expect(page.locator("#studentClassList")).toContainText("Kelas E2E");
  });

  test("student can open the history view", async ({ page }) => {
    // Click the Riwayat nav button
    await page.click("button[data-view='studentHistoryView']");
    await expect(page.locator("#studentHistoryView")).toBeVisible();
  });
});
