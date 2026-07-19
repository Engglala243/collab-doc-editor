import { test, expect } from "@playwright/test";

test.describe("App Smoke Test", () => {
  test("homepage loads successfully", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBeLessThan(400);
  });
});
