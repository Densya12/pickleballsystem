import { expect, test, type Locator, type Page } from "@playwright/test";
import { startSession } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

// QA-04: errors on New session must show where the organizer is looking
// (the buttons are at the bottom, the alert and fields at the top).

async function inViewport(page: Page, locator: Locator): Promise<boolean> {
  const box = await locator.boundingBox();
  const h = page.viewportSize()!.height;
  return Boolean(box && box.y >= 0 && box.y + box.height <= h);
}

for (const size of [
  { name: "360x640", viewport: { width: 360, height: 640 } },
  { name: "Pixel 7", viewport: null },
]) {
  test(`New session on ${size.name}: live notice up front, BR1 refusal and field errors in view`, async ({ page }) => {
    if (size.viewport) await page.setViewportSize(size.viewport);
    await signInWithNewClub(page, "new-session-errors", "Errors Club");
    await startSession(page, "Already Live", { courts: 1 });

    // On page load: the live session is named, with a link to it.
    await page.goto("/sessions/new");
    await expect(page.getByText("Already Live is live now.", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Already Live" })).toBeVisible();

    // Start anyway (BR1): the refusal is focused and on screen, and repeated above the button.
    await page.getByLabel("Session name").fill("Second Session");
    const start = page.getByRole("button", { name: "Start session" });
    await start.scrollIntoViewIfNeeded();
    await start.click();
    const alert = page.getByRole("alert").filter({ hasText: "Another session is live" });
    await expect(alert).toBeFocused();
    await expect.poll(() => inViewport(page, alert)).toBe(true);
    if (size.viewport) await page.screenshot({ path: "docs/qa/img/fix-qa-04-br1-in-view.png" });
    await start.scrollIntoViewIfNeeded();
    const nearButton = page.locator("form > div").last().getByText("Another session is live. End it before starting a new one.");
    await expect(nearButton).toBeVisible();

    // Field errors: the first invalid field gets focus and is on screen.
    await page.goto("/sessions/new");
    await page.getByLabel("Ends").fill("2026-01-01T08:00");
    const draft = page.getByRole("button", { name: "Save as draft" });
    await draft.scrollIntoViewIfNeeded();
    await draft.click();
    const name = page.getByLabel("Session name");
    await expect(name).toBeFocused();
    await expect.poll(() => inViewport(page, name)).toBe(true);
    await expect(page.getByText("Enter a session name.")).toBeVisible();
  });
}
