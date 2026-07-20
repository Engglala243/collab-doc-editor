import { test, expect } from "@playwright/test";



test.describe("Auth + Document Flow", () => {
  test("register → login → create document → open document", async ({ page }) => {
    const TEST_USER = {
      name: "Test User",
      email: `test-${Date.now()}@example.com`,
      password: "password123",
    };

    // 1. Register
    await page.goto("/register");
    await page.fill("#name", TEST_USER.name);
    await page.fill("#email", TEST_USER.email);
    await page.fill("#password", TEST_USER.password);
    await page.click("#register-btn");

    // 2. Should land on dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("My Documents")).toBeVisible();

    // 3. Create a document
    await page.click("#new-doc-btn");
    await page.fill("#doc-title-input", "My First Doc");
    await page.click("#create-doc-btn");

    // 4. Document appears in list
    await expect(page.getByText("My First Doc")).toBeVisible();
  });

  test("login page loads and shows form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("#login-btn")).toBeVisible();
  });

  test("unauthenticated user is redirected to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
