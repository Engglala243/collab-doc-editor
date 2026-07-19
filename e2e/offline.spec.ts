import { test, expect } from "@playwright/test";

test.describe("Phase 4: Offline-First Editor", () => {
  const TEST_USER = {
    name: "Offline User",
    email: `offline-${Date.now()}@example.com`,
    password: "password123",
  };

  test("should persist changes offline and restore after refresh", async ({ page, context }) => {
    // 1. Register and Login
    await page.goto("/register");
    await page.fill("#name", TEST_USER.name);
    await page.fill("#email", TEST_USER.email);
    await page.fill("#password", TEST_USER.password);
    await page.click("#register-btn");

    await expect(page).toHaveURL(/\/dashboard/);

    // 2. Create a Document
    await page.click("#new-doc-btn");
    await page.fill("#doc-title-input", "Offline Test Doc");
    await page.click("#create-doc-btn");
    
    // 3. Navigate to Document
    await page.click("text=Offline Test Doc");
    await expect(page.locator(".ProseMirror")).toBeVisible();

    // 4. Simulate Offline Mode
    await context.setOffline(true);
    await expect(page.getByText("Saved locally")).toBeVisible(); // Initially loaded from IndexedDB

    // 5. Type while offline
    await page.locator(".ProseMirror").fill("This is typed while offline.");
    
    // Status should change to Unsynced changes
    await expect(page.getByText("Unsynced changes")).toBeVisible();

    // Wait a moment for IndexedDB persistence to catch up
    await page.waitForTimeout(500);

    // 6. Refresh the page (still offline)
    await page.reload();

    // 7. Verify content is restored
    await expect(page.locator(".ProseMirror")).toHaveText("This is typed while offline.");
    await expect(page.getByText("Unsynced changes")).toBeVisible();

    // 8. Reconnect to Internet
    await context.setOffline(false);
    
    // Wait for the sync loop to pick up and sync
    await expect(page.getByText("Synced", { exact: true })).toBeVisible({ timeout: 10000 });
  });
});
