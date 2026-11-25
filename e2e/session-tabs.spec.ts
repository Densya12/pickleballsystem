import { expect, test } from "@playwright/test";
import { addWalkIn, endSession, openMore, openTab, PAYMENTS_URL, QUEUE_URL, sessionTabs, SESSION_URL, startSession } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

// D19: inside a live session, a floating tab bar: Courts · Queue · Payments · More.

test("session tab bar: Courts, Queue, Payments (with badge), More, and the old /live URL", async ({ page }) => {
  await signInWithNewClub(page, "tabs", "Tabs Club");
  await startSession(page, "Tabs Night", { courts: 1 });
  const courtsUrl = page.url();
  const tabs = sessionTabs(page);

  // Courts is the session's main page and the current tab.
  await expect(tabs.getByRole("link", { name: "Courts" })).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("link", { name: "Queue · 0" })).toBeVisible();
  await expect(tabs.getByRole("link", { name: "Payments" })).toBeVisible();
  await expect(tabs.getByRole("button", { name: "More" })).toBeVisible();
  // The header: "‹ Home", the QR icon button and "+ Walk-in".
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Show QR" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Walk-in" })).toBeVisible();

  // An unpaid walk-in: the Queue count and the Payments badge go up.
  await addWalkIn(page, "Badge Ben");
  await expect(page).toHaveURL(QUEUE_URL);
  await expect(tabs.getByRole("link", { name: "Queue · 1" })).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("link", { name: "Payments, 1 to act on" })).toBeVisible();

  await openTab(page, "Payments");
  await expect(page).toHaveURL(PAYMENTS_URL);
  await expect(page.getByRole("heading", { level: 1, name: "Payments" })).toBeVisible();
  await expect(tabs.getByRole("link", { name: /^Payments/ })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Download list" })).toBeVisible();

  await openTab(page, "Courts");
  await expect(page.getByRole("heading", { level: 1, name: "Tabs Night" })).toBeVisible();

  // More: Show QR, Read calls aloud, Session details, End session (with a confirm).
  const more = await openMore(page);
  await expect(more.getByRole("link", { name: "Show QR" })).toBeVisible();
  await expect(more.getByRole("switch", { name: /Read calls aloud/ })).toBeChecked();
  const details = more.getByRole("button", { name: "Session details" });
  await expect(details).toHaveAttribute("aria-expanded", "false");
  await details.click();
  await expect(details).toHaveAttribute("aria-expanded", "true");
  await expect(more.getByRole("region", { name: "Session details" })).toContainText("1 court");
  await more.getByRole("button", { name: "End session" }).click();
  await expect(more.getByText("End the session? Check-in closes.")).toBeVisible();
  await more.getByRole("button", { name: "Keep going" }).click();
  await page.keyboard.press("Escape");
  await expect(more).toBeHidden();

  // Old links still work: /s/[id]/live opens Courts.
  await page.goto(`${courtsUrl}/live`);
  await expect(page).toHaveURL(SESSION_URL);
  await expect(tabs.getByRole("link", { name: "Courts" })).toHaveAttribute("aria-current", "page");

  // Ended: the summary has its own page, without the tab bar; Queue redirects to it.
  await endSession(page);
  await expect(tabs).toHaveCount(0);
  await page.goto(`${courtsUrl}/queue`);
  await expect(page).toHaveURL(SESSION_URL);
  await expect(page.getByRole("heading", { level: 1, name: "Summary" })).toBeVisible();
});
