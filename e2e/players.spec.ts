import { expect, test, type Browser, type Page } from "@playwright/test";
import { addWalkIn, banner, court, endSession, onCourt, openTab, queueRows, queueSection, startSession } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

/** A separate phone (fresh browser context, no account) that counts vibrations. */
async function playerPhone(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    const w = window as unknown as { __vibrations: number };
    w.__vibrations = 0;
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: () => {
        w.__vibrations += 1;
        return true;
      },
    });
  });
  return page;
}

async function joinLink(organizer: Page): Promise<string> {
  await organizer.getByRole("link", { name: "Show QR" }).click();
  const link = (await organizer.getByText(/\/j\/[A-Z2-9]{6}$/).textContent())!;
  await organizer.getByRole("link", { name: "Courts" }).click();
  return new URL(link).pathname;
}

async function checkIn(player: Page, path: string, name: string) {
  await player.goto(path);
  await player.getByLabel("Name", { exact: true }).fill(name);
  // Phase 5 (BR13): with a fee, pick GCash or cash. These sessions don't use pay_first.
  await player.getByRole("radio", { name: "Cash", exact: true }).check();
  await player.getByRole("button", { name: "Join queue" }).click();
  await expect(player).toHaveURL(new RegExp(`${path}/me$`));
  await expect(player.getByRole("heading", { level: 1, name: `Hi, ${name.split(" ")[0]}` })).toBeVisible();
}

const position = (player: Page) => player.getByTestId("position");
const ahead = (player: Page) => player.getByTestId("ahead");

test("a player checks in by link, gets called, swaps out, pauses, leaves, rejoins, and sees the end", async ({ page: organizer, browser }) => {
  test.setTimeout(90_000);
  await signInWithNewClub(organizer, "players", "Makati Picklers");
  await startSession(organizer, "Phone Night", { courts: 1 });
  for (const name of ["Walk One", "Walk Two", "Walk Three"]) await addWalkIn(organizer, name);
  const path = await joinLink(organizer);

  // Check-in page: public, no sign-in until "Join queue".
  const player = await playerPhone(browser);
  await player.goto(path);
  await expect(player.getByRole("heading", { level: 1, name: "Phone Night" })).toBeVisible();
  await expect(player.getByText("3 in queue · 1 court")).toBeVisible();
  await expect(player.getByText(/We only collect your name and level/)).toBeVisible();
  expect((await player.context().cookies()).some((c) => c.name.includes("auth-token"))).toBe(false);

  await checkIn(player, path, "Pia Cruz");
  await expect(position(player)).toHaveText("4");
  await expect(player.getByText("You're in the next group")).toBeVisible();
  await expect(ahead(player)).toHaveText("Ahead of you: Walk One, Walk Two, Walk Three");
  await expect(player.locator('[data-live-sync="connected"]')).toBeVisible();

  // The organizer sees the phone player; opening the page again goes straight to My place.
  await openTab(organizer, "Queue");
  await expect(queueRows(organizer).getByText("Pia Cruz")).toBeVisible({ timeout: 2_000 });
  await player.goto(path);
  await expect(player).toHaveURL(new RegExp(`${path}/me$`));
  await expect(player.locator('[data-live-sync="connected"]')).toBeVisible();

  // Called: "You're up" within 2 seconds, with the court and a mini court (her chip in lime).
  for (const name of ["Walk Four", "Walk Five"]) await addWalkIn(organizer, name);
  await openTab(organizer, "Courts");
  await court(organizer, "Court 1").getByRole("button", { name: "Call next 4" }).click();
  await expect(player.getByRole("heading", { name: "Your turn, Pia!" })).toBeVisible({ timeout: 2_000 });
  await expect(player.getByRole("alert").filter({ hasText: "You're up" })).toContainText("Head to");
  await expect(player.getByRole("alert").filter({ hasText: "You're up" })).toContainText("Court 1");
  await expect(player.locator("[data-chip]")).toHaveText(["Walk One", "Walk Two", "Walk Three", "Pia"]);
  await expect(player.locator('[data-chip="me"]')).toHaveText("Pia");
  await expect.poll(() => player.evaluate(() => (window as unknown as { __vibrations: number }).__vibrations)).toBeGreaterThan(0);

  // BR19: not ready -> the organizer sees it and taps Swap -> back at #1.
  await player.getByRole("button", { name: "Not ready yet" }).click();
  await player.getByRole("button", { name: "Yes, I'm not ready" }).click();
  await expect(player.getByText(/The organizer knows/)).toBeVisible();
  const swap = court(organizer, "Court 1").getByRole("button", { name: "Pia isn't ready · Swap" });
  await expect(swap).toBeVisible({ timeout: 2_000 });
  await swap.click();
  await expect(banner(organizer)).toHaveText(/Walk Four replaced Pia Cruz on Court 1\. Pia Cruz is now first in the queue\./);
  await expect(onCourt(organizer, "Court 1")).toHaveText(["Walk One", "Walk Two", "Walk Three", "Walk Four"]);
  await expect(position(player)).toHaveText("1", { timeout: 2_000 });
  await expect(player.getByRole("heading", { level: 1, name: "Hi, Pia" })).toBeVisible();

  // BR17: pause and resume keep the place.
  await openTab(organizer, "Queue");
  await player.getByRole("button", { name: "Take a break" }).click();
  await expect(player.getByRole("heading", { level: 1, name: "You're resting" })).toBeVisible();
  await expect(player.getByText("Your spot is saved (#1). You won't be called until you're back.")).toBeVisible();
  await expect(queueSection(organizer, "On hold").getByRole("button", { name: /Pia Cruz/ })).toContainText("Resting", { timeout: 2_000 });
  await player.getByRole("button", { name: "I'm ready to play" }).click();
  await expect(position(player)).toHaveText("1");

  // BR18: leave (with confirm), then check in again -> end of the queue.
  await player.getByRole("button", { name: "Leave queue" }).click();
  await player.getByRole("button", { name: "Yes, leave" }).click();
  await expect(player.getByRole("heading", { level: 1, name: "Thanks for playing!" })).toBeVisible();
  await expect(queueRows(organizer).getByText("Pia Cruz")).toHaveCount(0, { timeout: 2_000 });
  await player.getByRole("link", { name: "Join again" }).click();
  // D18: this phone is remembered, so re-joining is one tap (plus the payment choice).
  await player.getByRole("radio", { name: "Cash", exact: true }).check();
  await player.getByRole("button", { name: "Join as Pia Cruz" }).click();
  await expect(player.getByRole("heading", { level: 1, name: "Hi, Pia" })).toBeVisible();
  await expect(position(player)).toHaveText("2");
  await expect(ahead(player)).toHaveText("Ahead of you: Walk Five");

  // The organizer ends the session -> the closing message on the phone.
  await endSession(organizer);
  await expect(player.getByRole("heading", { level: 1, name: "Open play is over. Thanks!" })).toBeVisible({ timeout: 5_000 });
  await player.goto(path);
  await expect(player.getByText("Check-in is closed.", { exact: false })).toBeVisible();
  await player.context().close();
});

test("an anonymous player is not an organizer", async ({ page: organizer, browser }) => {
  await signInWithNewClub(organizer, "anonorg", "QC Paddlers");
  await startSession(organizer, "Anon Night", { courts: 1 });
  const path = await joinLink(organizer);

  const player = await playerPhone(browser);
  await checkIn(player, path, "Curious Carl");
  // Organizer pages send an anonymous player to sign in (no redirect loop).
  await player.goto("/");
  await expect(player).toHaveURL(/\/login$/);
  await expect(player.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await player.goto(new URL(organizer.url()).pathname);
  await expect(player).toHaveURL(/\/login\?next=/);
  await player.context().close();
});
