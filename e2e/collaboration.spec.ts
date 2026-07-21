import { test, expect } from "@playwright/test";

test.describe("Phase 3: Collaboration & Permissions", () => {
  const timestamp = Date.now();
  const ownerEmail = `owner_${timestamp}@example.com`;
  const guestEmail = `guest_${timestamp}@example.com`;

  test("should handle inviting, role changing, and removing a collaborator", async ({ browser }) => {
    // We need two independent contexts for two users
    const ownerContext = await browser.newContext();
    const guestContext = await browser.newContext();
    
    const ownerPage = await ownerContext.newPage();
    const guestPage = await guestContext.newPage();

    // 1. Owner registers and creates a document
    await ownerPage.goto("/register");
    await ownerPage.fill("#name", "Owner User");
    await ownerPage.fill("#email", ownerEmail);
    await ownerPage.fill("#password", "password123");
    await ownerPage.click("#register-btn");
    await ownerPage.waitForURL(/\/dashboard/, { timeout: 15000 });

    await ownerPage.click("#new-doc-btn");
    await ownerPage.fill("#doc-title-input", "Top Secret Plan");
    await ownerPage.click("#create-doc-btn");
    await expect(ownerPage.getByText("Top Secret Plan")).toBeVisible();
    await ownerPage.click("text=Open");
    await expect(ownerPage.locator("h1")).toContainText("Top Secret Plan");

    // 2. Guest registers (but has no documents initially)
    await guestPage.goto("/register");
    await guestPage.fill("#name", "Guest User");
    await guestPage.fill("#email", guestEmail);
    await guestPage.fill("#password", "password123");
    await guestPage.click("#register-btn");
    await guestPage.waitForURL(/\/dashboard/, { timeout: 15000 });
    await expect(guestPage.locator("text=No documents yet")).toBeVisible();

    // 3. Owner invites Guest as EDITOR
    await ownerPage.click("text=Share");
    await expect(ownerPage.locator("text=Share Document")).toBeVisible();
    await ownerPage.fill('input[placeholder="User\'s email address..."]', guestEmail);
    
    // Wait for the invite API to complete
    const inviteResponsePromise = ownerPage.waitForResponse(
      response =>
        response.url().includes("/collaborators") &&
        response.request().method() === "POST" &&
        response.ok()
    );

    await ownerPage.click("button:has-text('Invite')");
    await inviteResponsePromise;
    await expect(ownerPage.locator("text=User invited successfully!")).toBeVisible();

    // Verify guest appears in the collaborator list
    const collaboratorRow = ownerPage.locator(`[data-testid="collaborator-row-${guestEmail}"]`);
    await expect(collaboratorRow).toBeVisible({ timeout: 15000 });

    // 4. Guest checks dashboard and sees the document
    await guestPage.reload();
    await expect(guestPage.locator("text=Top Secret Plan")).toBeVisible();
    await expect(guestPage.locator("text=EDITOR")).toBeVisible();

    // 5. Guest opens document and can edit
    await guestPage.click("text=Open");
    await expect(guestPage.locator("h1")).toContainText("Top Secret Plan");
    // Ensure Tiptap is editable (contenteditable="true")
    await expect(guestPage.locator(".ProseMirror")).toHaveAttribute("contenteditable", "true");

    // 6. Owner changes Guest's role to VIEWER
    const roleTrigger = collaboratorRow.getByTestId("role-trigger");
    await expect(roleTrigger).toBeVisible();
    await roleTrigger.click();

    const viewerOption = ownerPage.getByTestId("role-option-viewer");
    await expect(viewerOption).toBeVisible();
    await viewerOption.click();
    
    // We should wait a moment for the PATCH request to complete
    await ownerPage.waitForTimeout(1000);

    // 7. Guest reloads and should now be a VIEWER (read-only)
    await guestPage.reload();
    await expect(guestPage.locator("h1")).toContainText("Top Secret Plan");
    await expect(guestPage.locator("text=VIEWER")).toBeVisible();
    await expect(guestPage.locator(".ProseMirror")).toHaveAttribute("contenteditable", "false");

    // 8. Owner removes Guest entirely
    ownerPage.on('dialog', dialog => dialog.accept()); // Automatically accept the "Are you sure?" alert
    await collaboratorRow.locator('button[title="Remove access"]').click();
    await ownerPage.waitForTimeout(500);
    await expect(ownerPage.locator(`text=${guestEmail}`)).not.toBeVisible();

    // 9. Guest reloads and should get Access Denied
    await guestPage.reload();
    await expect(guestPage.locator("text=Access Denied")).toBeVisible();
    
    await ownerContext.close();
    await guestContext.close();
  });
});
