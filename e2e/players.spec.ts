import { expect, test, type Browser, type Page } from "@playwright/test";
import { addWalkIn, banner, court, onCourt, queue, startSession } from "./support/live";
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
  await organizer.getByRole("link", { name: "Ipakita ang QR" }).click();
  const link = (await organizer.getByText(/\/j\/[A-Z2-9]{6}$/).textContent())!;
  await organizer.getByRole("link", { name: "Bumalik" }).click();
  return new URL(link).pathname;
}

async function checkIn(player: Page, path: string, name: string) {
  await player.goto(path);
  await player.getByLabel("Pangalan mo").fill(name);
  // Phase 5 (BR13): with a fee, pick GCash or cash. These sessions don't use pay_first.
  await player.getByRole("switch", { name: "Cash ang ibabayad ko" }).check();
  await player.getByRole("button", { name: "Pumila na" }).click();
  await expect(player).toHaveURL(new RegExp(`${path}/me$`));
  await expect(player.getByRole("heading", { level: 1, name: `Hi, ${name}!` })).toBeVisible();
}

const position = (player: Page) => player.getByTestId("position");

test("a player checks in by link, gets called, swaps out, pauses, leaves, rejoins, and sees the end", async ({ page: organizer, browser }) => {
  test.setTimeout(90_000);
  await signInWithNewClub(organizer, "players", "Makati Picklers");
  await startSession(organizer, "Phone Night", { courts: 1 });
  for (const name of ["Walk One", "Walk Two", "Walk Three"]) await addWalkIn(organizer, name);
  const path = await joinLink(organizer);

  // Check-in page: public, no sign-in until "Pumila na".
  const player = await playerPhone(browser);
  await player.goto(path);
  await expect(player.getByRole("heading", { level: 1, name: "Phone Night" })).toBeVisible();
  await expect(player.getByText("3 ang nakapila · 1 court")).toBeVisible();
  await expect(player.getByText(/Pangalan at level lang ang kinukuha namin/)).toBeVisible();
  await expect(player.getByText("Walang account o app na kailangan.")).toBeVisible();
  expect((await player.context().cookies()).some((c) => c.name.includes("auth-token"))).toBe(false);

  await checkIn(player, path, "Phone Pia");
  await expect(position(player)).toHaveText("#4");
  await expect(player.getByText("Sa susunod na bakanteng court ka na")).toBeVisible();
  await expect(player.getByRole("region", { name: "Mga nauuna sa iyo" }).getByRole("listitem")).toHaveText(["Walk One", "Walk Two", "Walk Three"]);
  await expect(player.locator('[data-live-sync="connected"]')).toBeVisible();

  // The organizer sees the phone player; opening the page again goes straight to Pwesto.
  await expect(queue(organizer).getByText("Phone Pia")).toBeVisible({ timeout: 2_000 });
  await player.goto(path);
  await expect(player).toHaveURL(new RegExp(`${path}/me$`));
  await expect(player.locator('[data-live-sync="connected"]')).toBeVisible();

  // Called: "Ikaw na" within 2 seconds, with the court and the other 3 (no teams).
  for (const name of ["Walk Four", "Walk Five"]) await addWalkIn(organizer, name);
  await court(organizer, "Court 1").getByRole("button", { name: "Tawagin ang susunod" }).click();
  await expect(player.getByText("Ikaw na, Phone Pia!")).toBeVisible({ timeout: 2_000 });
  await expect(player.getByText("Pumunta ka na sa Court 1")).toBeVisible();
  await expect(player.getByRole("region", { name: "Kasama mo sa court:" }).getByRole("listitem")).toHaveText(["Walk One", "Walk Two", "Walk Three"]);
  await expect.poll(() => player.evaluate(() => (window as unknown as { __vibrations: number }).__vibrations)).toBeGreaterThan(0);

  // BR19: not ready -> the organizer sees it and taps Palitan -> back at #1.
  await player.getByRole("button", { name: "Hindi pa ako handa (ibalik sa pila)" }).click();
  await player.getByRole("button", { name: "Oo, hindi pa ako handa" }).click();
  await expect(player.getByText(/Sinabihan na ang organizer/)).toBeVisible();
  await expect(court(organizer, "Court 1").getByText("Hindi pa handa si Phone Pia")).toBeVisible({ timeout: 2_000 });
  await court(organizer, "Court 1").getByRole("button", { name: "Palitan" }).click();
  await expect(banner(organizer)).toHaveText(/Pinalitan si Phone Pia ni Walk Four sa Court 1\. Nasa unahan na ng pila si Phone Pia\./);
  await expect(onCourt(organizer, "Court 1")).toHaveText(["Walk One", "Walk Two", "Walk Three", "Walk Four"]);
  await expect(position(player)).toHaveText("#1", { timeout: 2_000 });
  await expect(player.getByRole("heading", { level: 1, name: "Hi, Phone Pia!" })).toBeVisible();

  // BR17: pause and resume keep the place.
  await player.getByRole("button", { name: "Pahinga muna" }).click();
  await expect(player.getByRole("heading", { level: 1, name: "Nagpapahinga ka" })).toBeVisible();
  await expect(player.getByText("Naka-hold ang pwesto mo (#1). Hindi ka muna tatawagin hangga't hindi ka bumabalik.")).toBeVisible();
  await expect(queue(organizer).getByRole("button", { name: /Phone Pia/ })).toContainText("Naka-pause", { timeout: 2_000 });
  await player.getByRole("button", { name: "Handa na ulit akong maglaro" }).click();
  await expect(position(player)).toHaveText("#1");

  // BR18: leave (with confirm), then check in again -> end of the queue.
  await player.getByRole("button", { name: "Aalis na ako" }).click();
  await player.getByRole("button", { name: "Oo, aalis na ako" }).click();
  await expect(player.getByRole("heading", { level: 1, name: "Salamat sa paglalaro!" })).toBeVisible();
  await expect(queue(organizer).getByText("Phone Pia")).toHaveCount(0, { timeout: 2_000 });
  await player.getByRole("link", { name: "Pumila ulit" }).click();
  // D18: this phone is remembered, so re-joining is one tap (plus the payment choice).
  await player.getByRole("switch", { name: "Cash ang ibabayad ko" }).check();
  await player.getByRole("button", { name: "Pumila bilang Phone Pia" }).click();
  await expect(player.getByRole("heading", { level: 1, name: "Hi, Phone Pia!" })).toBeVisible();
  await expect(position(player)).toHaveText("#2");
  await expect(player.getByRole("region", { name: "Mga nauuna sa iyo" }).getByRole("listitem")).toHaveText(["Walk Five"]);

  // The organizer ends the session -> the closing message on the phone.
  await organizer.getByRole("button", { name: "Tapusin ang session" }).click();
  await organizer.getByRole("button", { name: "Oo, tapusin" }).click();
  await expect(player.getByRole("heading", { level: 1, name: "Tapos na ang open play. Salamat!" })).toBeVisible({ timeout: 5_000 });
  await player.goto(path);
  await expect(player.getByText("Sarado na ang check-in.", { exact: false })).toBeVisible();
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
  await expect(player.getByRole("button", { name: "Mag-sign in gamit ang Google" })).toBeVisible();
  await player.goto(new URL(organizer.url()).pathname);
  await expect(player).toHaveURL(/\/login\?next=/);
  await player.context().close();
});
