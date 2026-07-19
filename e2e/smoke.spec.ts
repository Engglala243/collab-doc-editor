import { test, expect } from "@playwright/test";

test.describe("App Smoke Test", () => {
  test("homepage loads successfully", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/doc-editor|collab|Next\.js/i);
  });
});
