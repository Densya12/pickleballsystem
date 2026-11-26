import { expect, test } from "@playwright/test";
import { addWalkIn, court, onCourt, openMore, openTab, QUEUE_URL, SESSION_URL, sessionTabs, startSession, finishGame } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

// QA-01 (NF10): without signal, in-session links stay on the current tab and
// explain why, instead of loading the browser's offline page.

test("offline: tab bar, Home, Show QR, Walk-in and More links don't leave the app", async ({ page, context }) => {
  test.setTimeout(90_000);
  await signInWithNewClub(page, "offline-nav", "Offline Nav Club");
  await startSession(page, "Offline Nav Night", { courts: 1 });
  for (const n of ["T1", "T2", "T3", "T4", "T5"]) await addWalkIn(page, n);
  await openTab(page, "Courts");
  await court(page, "Court 1").getByRole("button", { name: "Call next 4" }).click();
  await expect(onCourt(page, "Court 1")).toHaveText(["T1", "T2", "T3", "T4"]);
  await openTab(page, "Queue");
  await openTab(page, "Courts");

  await context.setOffline(true);
  await expect(page.getByText("Offline — will save when signal returns").filter({ visible: true })).toBeVisible();
  const notice = (target: string) =>
    page.getByText(`Needs signal to open ${target}. Your taps are saved and will send when you're back online.`);

  await sessionTabs(page).getByRole("link", { name: /^Queue/ }).click();
  await expect(notice("Queue")).toBeVisible();
  await expect(page).toHaveURL(SESSION_URL);
  await expect(sessionTabs(page)).toBeVisible();
  await page.screenshot({ path: "docs/qa/img/fix-qa-01-offline-tab.png" });

  await page.getByRole("link", { name: "Home" }).click();
  await expect(notice("Home")).toBeVisible();
  await page.getByRole("link", { name: "Show QR" }).click();
  await expect(notice("Show QR")).toBeVisible();
  await page.getByRole("link", { name: "Walk-in" }).click();
  await expect(notice("Walk-in")).toBeVisible();
  const more = await openMore(page);
  await more.getByRole("link", { name: "Show QR" }).click();
  await expect(notice("Show QR")).toBeVisible();
  await expect(page).toHaveURL(SESSION_URL);
  await page.keyboard.press("Escape");

  // A Done made offline still waits in the outbox, and is sent once the signal is back.
  await finishGame(page, "Court 1");
  await expect(page.getByRole("region", { name: "Waiting for signal" })).toBeVisible();

  await context.setOffline(false);
  await expect(notice("Queue")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Waiting for signal" })).toHaveCount(0, { timeout: 15_000 });
  await sessionTabs(page).getByRole("link", { name: /^Queue/ }).click();
  await expect(page).toHaveURL(QUEUE_URL);
});
