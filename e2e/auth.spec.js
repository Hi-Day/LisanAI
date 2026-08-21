const { test, expect } = require("@playwright/test");

test.describe("Auth flow", () => {
  test("shows the login page for guests", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#loginForm")).toBeVisible();
    await expect(page.locator("#openRegisterModalBtn")).toBeVisible();
  });

  test("admin can log in and see the observability dashboard", async ({ page }) => {
    await page.goto("/");
    await page.fill("#loginEmail", "e2e.admin@example.com");
    await page.fill("#loginPassword", "password123");
    await page.click("#loginForm button[type='submit']");

    // Wait for the app shell to become visible
    await expect(page.locator("#appShell")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("#accountName")).toHaveText("Admin E2E");
    // Admin nav should show Observabilitas
    await expect(page.locator("#mainNav")).toContainText("Observabilitas");
  });

  test("teacher can log in and see the assessment wizard", async ({ page }) => {
    await page.goto("/");
    await page.fill("#loginEmail", "e2e.guru@example.com");
    await page.fill("#loginPassword", "password123");
    await page.click("#loginForm button[type='submit']");

    await expect(page.locator("#appShell")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("#accountName")).toHaveText("Guru E2E");
    // Teacher nav should show Penilaian, Kelas, Monitoring
    await expect(page.locator("#mainNav")).toContainText("Penilaian");
    await expect(page.locator("#mainNav")).toContainText("Kelas");
    await expect(page.locator("#mainNav")).toContainText("Monitoring");
  });

  test("student can log in and see the student view", async ({ page }) => {
    await page.goto("/");
    await page.fill("#loginEmail", "e2e.siswa@example.com");
    await page.fill("#loginPassword", "password123");
    await page.click("#loginForm button[type='submit']");

    await expect(page.locator("#appShell")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("#accountName")).toHaveText("Siswa E2E");
    // Student nav should show Kerjakan and Riwayat
    await expect(page.locator("#mainNav")).toContainText("Kerjakan");
    await expect(page.locator("#mainNav")).toContainText("Riwayat");
  });

  test("login with wrong password shows an error toast", async ({ page }) => {
    await page.goto("/");
    await page.fill("#loginEmail", "e2e.admin@example.com");
    await page.fill("#loginPassword", "wrong-password");
    await page.click("#loginForm button[type='submit']");

    // Should stay on the auth view
    await expect(page.locator("#authView")).toBeVisible();
    await expect(page.locator("#appShell")).toBeHidden();
  });
});
