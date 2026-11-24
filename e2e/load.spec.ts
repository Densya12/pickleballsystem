import { expect, test, type Page } from "@playwright/test";
import { court, SESSION_URL } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

// Acceptance (Phase 6): 10 player phones in one session. Every player must
// reach "Ikaw na!" within 5 seconds of the organizer's tap.

const PLAYERS = Array.from({ length: 10 }, (_, i) => `Player ${String(i + 1).padStart(2, "0")}`);
const LIMIT_MS = 5_000;

/** Resolves when this phone shows "Ikaw na!" (checked every 50 ms in the page). */
function calledOn(player: Page) {
  return player.waitForFunction(() => document.querySelector('[data-state="playing"] [role="alert"]') !== null, null, {
    polling: 50,
    timeout: 15_000,
  });
}

test("10 phones: every player sees 'Ikaw na!' within 5 seconds of the call", async ({ page: organizer, browser }, testInfo) => {
  test.setTimeout(180_000);
  await signInWithNewClub(organizer, "load", "Load Club");
  await organizer.getByRole("link", { name: "Bagong open play" }).click();
  await organizer.getByLabel("Pangalan ng session").fill("Load Night");
  await organizer.getByLabel("Bayad bawat player (₱)").fill("0");
  await organizer.getByRole("button", { name: "Simulan ang session" }).click();
  await expect(organizer).toHaveURL(SESSION_URL);
  const liveUrl = organizer.url();

  await organizer.getByRole("link", { name: "Ipakita ang QR" }).click();
  const path = new URL((await organizer.getByText(/\/j\/[A-Z2-9]{6}$/).textContent())!).pathname;
  await organizer.goto(liveUrl);

  const phones = new Map<string, Page>();
  for (const name of PLAYERS) {
    const player = await (await browser.newContext()).newPage();
    await player.goto(path);
    await player.getByLabel("Pangalan mo").fill(name);
    await player.getByRole("button", { name: "Pumila na" }).click();
    await expect(player.getByRole("heading", { level: 1, name: `Hi, ${name}!` })).toBeVisible();
    phones.set(name, player);
  }
  for (const player of phones.values()) await expect(player.locator('[data-live-sync="connected"]')).toBeVisible();
  await expect(organizer.getByText(PLAYERS[9])).toBeVisible();

  const results: { name: string; action: string; ms: number }[] = [];
  async function measure(action: string, tap: () => Promise<void>, called: string[]) {
    const waits = called.map((name) => calledOn(phones.get(name)!));
    const start = Date.now();
    await tap();
    await Promise.all(
      waits.map((wait, i) => wait.then(() => results.push({ name: called[i], action, ms: Date.now() - start }))),
    );
  }

  // 2 doubles courts: 8 called, then the court-1 finish calls the last 2 (and 2 again).
  await measure("Court 1: Tawagin", () => court(organizer, "Court 1").getByRole("button", { name: "Tawagin ang susunod" }).click(), PLAYERS.slice(0, 4));
  await measure("Court 2: Tawagin", () => court(organizer, "Court 2").getByRole("button", { name: "Tawagin ang susunod" }).click(), PLAYERS.slice(4, 8));
  await measure(
    "Court 1: Tapos na",
    () => court(organizer, "Court 1").getByRole("button", { name: "Tapos na · tawagin ang susunod" }).click(),
    PLAYERS.slice(8, 10),
  );

  results.sort((a, b) => a.name.localeCompare(b.name));
  const table = results.map((r) => `${r.name}  ${String(r.ms).padStart(5)} ms  (${r.action})`).join("\n");
  console.log(`\nTap -> "Ikaw na!" on each phone:\n${table}\n`);
  await testInfo.attach("call-timings.txt", { body: table, contentType: "text/plain" });

  expect(results.map((r) => r.name)).toEqual(PLAYERS);
  for (const r of results) expect(r.ms, `${r.name} (${r.action})`).toBeLessThan(LIMIT_MS);

  for (const player of phones.values()) await player.context().close();
});
