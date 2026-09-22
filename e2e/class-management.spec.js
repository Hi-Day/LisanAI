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
    await expect(page.locator("#classList article").filter({ hasText: className })).toHaveCount(1);
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

  test("new teacher sees every created class in the bulk-add and wizard dropdowns", async ({ page }) => {
    await login(page, "e2e.guru.baru@example.com");
    await page.click("#mainNav button[data-view='manageClassView']");
    await expect(page.locator("#manageClassView")).toBeVisible();

    const stamp = Date.now();
    const firstName = `Kelas Baru A ${stamp}`;
    const secondName = `Kelas Baru B ${stamp}`;

    await page.fill("#className", firstName);
    await page.click("#classForm button[type='submit']");
    const firstArticle = page.locator("#classList article").filter({ hasText: firstName });
    await expect(firstArticle).toHaveCount(1);
    const firstCode = (await firstArticle.locator("b").textContent()).trim();

    await page.fill("#className", secondName);
    await page.click("#classForm button[type='submit']");
    const secondArticle = page.locator("#classList article").filter({ hasText: secondName });
    await expect(secondArticle).toHaveCount(1);
    const secondCode = (await secondArticle.locator("b").textContent()).trim();

    // Bug B: zero approved members must NOT hide the bulk-add class options.
    await expect(page.locator("#bulkAddClassSelect option", { hasText: firstName })).toHaveCount(1);
    await expect(page.locator("#bulkAddClassSelect option", { hasText: secondName })).toHaveCount(1);

    // Bug C: the wizard dropdown must list both classes, distinguishable by join code.
    await page.click("#mainNav .nav-sub-item[data-nav-view='teacherView']");
    await expect(page.locator("#classSelect option", { hasText: `${firstName} (${firstCode})` })).toHaveCount(1);
    await expect(page.locator("#classSelect option", { hasText: `${secondName} (${secondCode})` })).toHaveCount(1);
  });

  test("submitting the create-class form twice only creates one class", async ({ page }) => {
    await login(page, "e2e.guru@example.com");
    await page.click("#mainNav button[data-view='manageClassView']");
    await expect(page.locator("#manageClassView")).toBeVisible();

    const className = `Kelas Sekali ${Date.now()}`;
    await page.fill("#className", className);
    await page.evaluate(() => {
      const form = document.querySelector("#classForm");
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    await expect(page.locator("#classList article").filter({ hasText: className })).toHaveCount(1);
  });
});
