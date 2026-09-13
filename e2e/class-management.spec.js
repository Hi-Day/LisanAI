const { test, expect } = require("@playwright/test");

async function login(page, email) {
  await page.goto("/");
  await page.fill("#loginEmail", email);
  await page.fill("#loginPassword", "password123");
  await page.click("#loginForm button[type='submit']");
  await expect(page.locator("#appShell")).toBeVisible({ timeout: 10_000 });
}

async function logout(page) {
  await page.click("#logoutButton");
  await expect(page.locator("#authView")).toBeVisible({ timeout: 10_000 });
}

test.describe("Class and membership workflow", () => {
  test("teacher creates a class, student requests to join, and teacher approves", async ({ page }) => {
    await login(page, "e2e.guru@example.com");
    await page.click("#mainNav button[data-view='manageClassView']");
    await expect(page.locator("#manageClassView")).toBeVisible();

    const className = `Kelas Membership ${Date.now()}`;
    await page.fill("#className", className);
    await page.click("#classForm button[type='submit']");

    const classArticle = page.locator("#classList article").filter({ hasText: className }).first();
    await expect(classArticle).toBeVisible();
    const joinCode = await classArticle.locator("b").textContent();
    expect(joinCode).toBeTruthy();

    await logout(page);
    await login(page, "e2e.siswa@example.com");
    await expect(page.locator("#studentView")).toBeVisible();

    await page.fill("#studentJoinCode", joinCode.trim());
    await page.click("#studentJoinClassForm button[type='submit']");
    await expect(page.locator("#studentClassList")).toContainText(className);
    await expect(page.locator("#studentClassList")).toContainText("Menunggu");

    await logout(page);
    await login(page, "e2e.guru@example.com");
    await page.click("#mainNav button[data-view='manageClassView']");
    await expect(page.locator("#manageClassView")).toBeVisible();
    await expect(page.locator("#pendingJoinList")).toContainText("Siswa E2E");
    await expect(page.locator("#pendingJoinList")).toContainText(className);

    await page.locator("#pendingJoinList .approve-join").first().click();
    await expect(page.locator("#pendingJoinList")).not.toContainText(className);
    await expect(page.locator("#approvedMemberList")).toContainText("Siswa E2E");
  });
});
