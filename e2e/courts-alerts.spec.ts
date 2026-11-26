import { expect, test, type Browser, type Page } from "@playwright/test";
import { addWalkIn, court, onCourt, openMore, openPlayer, openTab, SESSION_URL, startSession } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

// Phase 6: the players' Courts view (D14, BR21) and Tagatawag (D17).

async function phone(browser: Browser): Promise<Page> {
  return (await browser.newContext()).newPage();
}

async function joinPath(organizer: Page): Promise<string> {
  await organizer.getByRole("link", { name: "Show QR" }).click();
  const path = new URL((await organizer.getByText(/\/j\/[A-Z2-9]{6}(?:[A-Z2-9]{2})?$/).textContent())!).pathname;
  await organizer.getByRole("link", { name: "Courts" }).click();
  await expect(organizer).toHaveURL(SESSION_URL);
  return path;
}

function courtsRegion(player: Page, label: string) {
  return player.getByRole("region", { name: label, exact: true });
}

test("player Courts: who plays, who's next, holds, and 'You', live within 2 seconds", async ({ page: organizer, browser }) => {
  test.setTimeout(90_000);
  await signInWithNewClub(organizer, "courtsview", "Courts Club");
  await organizer.getByRole("link", { name: "New session" }).click();
  await organizer.getByLabel("Session name").fill("Courts Night");
  await organizer.getByRole("group", { name: "Court 2" }).getByRole("radio", { name: "Singles" }).check();
  await organizer.getByRole("switch", { name: "Pay before queueing" }).check();
  await organizer.getByRole("button", { name: "Start session" }).click();
  await expect(organizer).toHaveURL(SESSION_URL);

  for (const name of ["Paid One", "Paid Two", "Paid Three", "Paid Four"]) {
    await addWalkIn(organizer, name, "Level 2", { choice: "Paid cash" });
  }
  await addWalkIn(organizer, "Unpaid Uno", "Level 2", { choice: "Pay later" });
  const path = await joinPath(organizer);

  // Mia checks in, sends a GCash reference on My place (to check counts as paid, BR14;
  // payment isn't on the check-in page, QA-06) and opens Courts.
  const mia = await phone(browser);
  await mia.goto(path);
  await mia.getByLabel("Name", { exact: true }).fill("Mia Phone");
  await mia.getByRole("button", { name: "Join queue" }).click();
  await expect(mia.getByRole("heading", { level: 1, name: "Hi, Mia" })).toBeVisible();
  await mia.getByRole("button", { name: "Add GCash reference" }).click();
  await mia.getByLabel("GCash reference no.").fill("9876 5432 10");
  await mia.getByRole("button", { name: "Send reference" }).click();
  await expect(mia.locator('[data-payment="pending"]')).toBeVisible();
  await mia.getByRole("link", { name: "View courts" }).click();
  await expect(mia.getByRole("heading", { level: 1, name: "Courts" })).toBeVisible();
  await expect(mia.locator('[data-live-sync="connected"]').filter({ visible: true })).toHaveCount(1);

  await expect(courtsRegion(mia, "Court 1")).toContainText("Doubles · Empty");
  await expect(courtsRegion(mia, "Court 2")).toContainText("Singles · Empty");
  const ready = courtsRegion(mia, "Get ready").getByRole("listitem");
  await expect(ready).toHaveText(["#1Paid One", "#2Paid Two", "#3Paid Three", "#4Paid Four"]);
  // Mia is the 5th eligible: "After them", marked as herself (a word, not only color).
  const after = courtsRegion(mia, "After them").getByRole("listitem");
  await expect(after).toHaveText(["#5Mia PhoneYou"]);
  await expect(mia.locator("[data-me]")).toHaveText(["Mia PhoneYou"]);
  // pay_first: the unpaid walk-in is on hold.
  const onHold = courtsRegion(mia, "On hold").getByRole("listitem");
  await expect(onHold).toHaveText(["Unpaid UnoUnpaid"]);

  // A pause shows up live, and Mia moves into "Get ready".
  await openTab(organizer, "Queue");
  const sheet = await openPlayer(organizer, "Paid Four");
  await sheet.getByRole("button", { name: "Pause" }).click();
  // In queue order.
  await expect(onHold).toHaveText(["Paid FourResting", "Unpaid UnoUnpaid"], { timeout: 2_000 });
  await expect(ready).toHaveText(["#1Paid One", "#2Paid Two", "#3Paid Three", "#4Mia PhoneYou"]);

  // The organizer calls Court 1: Mia's phone shows the game and "You're up" within 2 seconds.
  await openTab(organizer, "Courts");
  await court(organizer, "Court 1").getByRole("button", { name: "Call next 4" }).click();
  await expect(onCourt(organizer, "Court 1")).toHaveText(["Paid One", "Paid Two", "Paid Three", "Mia Phone"]);
  await expect(courtsRegion(mia, "Court 1")).toContainText("Doubles · #1", { timeout: 2_000 });
  await expect(courtsRegion(mia, "Court 1").getByRole("listitem")).toHaveText(["Paid One", "Paid Two", "Paid Three", "Mia Phone (You)"]);
  await expect(courtsRegion(mia, "Court 1").locator('[data-chip="me"]')).toHaveText("Mia");
  const called = mia.getByRole("alert").filter({ hasText: "You're up" });
  await expect(called).toContainText("Your turn, Mia!");
  await expect(courtsRegion(mia, "Get ready")).toContainText("Nobody in the queue yet.");

  // On my way, then back to My place, which remembers it.
  await mia.getByRole("button", { name: "On my way" }).click();
  await expect(called).toHaveCount(0);
  await mia.getByRole("link", { name: "My place" }).click();
  await expect(mia.getByRole("heading", { level: 1, name: "Playing on Court 1" })).toBeVisible();
  await mia.context().close();
});

/** Records what the page would say aloud (instead of real speech). */
async function stubSpeech(page: Page) {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as unknown as { spoken: string[] }).spoken = spoken;
    const synth = {
      speaking: false,
      pending: false,
      paused: false,
      onvoiceschanged: null,
      getVoices: () => [],
      speak(utterance: SpeechSynthesisUtterance) {
        if (utterance.text) spoken.push(utterance.text);
        setTimeout(() => utterance.onend?.(new Event("end") as SpeechSynthesisEvent), 0);
      },
      cancel() {},
      pause() {},
      resume() {},
      addEventListener() {},
      removeEventListener() {},
    };
    Object.defineProperty(window, "speechSynthesis", { configurable: true, get: () => synth });
  });
}

const spoken = (page: Page) => page.evaluate(() => (window as unknown as { spoken: string[] }).spoken);

/** More › Read calls aloud, then close the sheet. */
async function setReadAloud(page: Page, on: boolean) {
  const more = await openMore(page);
  const toggle = more.getByRole("switch", { name: /Read calls aloud/ });
  if (on) await toggle.check();
  else await toggle.uncheck();
  await page.keyboard.press("Escape");
  await expect(more).toBeHidden();
}

async function readAloudIsOn(page: Page): Promise<boolean> {
  const more = await openMore(page);
  const checked = await more.getByRole("switch", { name: /Read calls aloud/ }).isChecked();
  await page.keyboard.press("Escape");
  await expect(more).toBeHidden();
  return checked;
}

test("Tagatawag reads each new call once, and stays silent when off (also after a reload)", async ({ page: organizer }) => {
  test.setTimeout(90_000);
  await stubSpeech(organizer);
  await signInWithNewClub(organizer, "tagatawag", "Tawag Club");
  await startSession(organizer, "Tawag Night", { courts: 2, formats: ["Doubles", "Singles"] });
  for (const name of ["Ana", "Ben", "Carlo", "Dina", "Ella", "Fely", "Gino", "Hana"]) await addWalkIn(organizer, name);
  await openTab(organizer, "Courts");

  expect(await readAloudIsOn(organizer)).toBe(true); // default ON
  expect(await spoken(organizer)).toEqual([]);

  // call_next on doubles, then on singles (in English, the default language).
  await court(organizer, "Court 1").getByRole("button", { name: "Call next 4" }).click();
  await expect.poll(() => spoken(organizer)).toEqual(["Court 1: Ana, Ben, Carlo, and Dina."]);
  await court(organizer, "Court 2").getByRole("button", { name: "Call next 2" }).click();
  await expect.poll(() => spoken(organizer)).toEqual(["Court 1: Ana, Ben, Carlo, and Dina.", "Court 2: Ella and Fely."]);

  // The automatic call after finish_game is read too, once.
  await organizer.getByRole("button", { name: "Done on Court 1" }).click();
  await expect.poll(() => spoken(organizer)).toHaveLength(3);
  expect((await spoken(organizer))[2]).toBe("Court 1: Gino, Hana, Ana, and Ben.");
  await organizer.waitForTimeout(1_500);
  expect(await spoken(organizer)).toHaveLength(3);

  // Off: silent.
  await setReadAloud(organizer, false);
  await organizer.getByRole("button", { name: "Done on Court 2" }).click();
  await expect(onCourt(organizer, "Court 2")).toHaveText(["Carlo", "Dina"]);
  await organizer.waitForTimeout(1_000);
  expect(await spoken(organizer)).toHaveLength(3);

  // Still off after a reload (remembered on this device), and the games on court aren't replayed.
  await organizer.reload();
  expect(await readAloudIsOn(organizer)).toBe(false);
  await organizer.getByRole("button", { name: "Done on Court 1" }).click();
  await expect(onCourt(organizer, "Court 1")).toHaveText(["Ella", "Fely", "Gino", "Hana"]);
  await organizer.waitForTimeout(1_000);
  expect(await spoken(organizer)).toEqual([]);

  // On again: nothing old is read; the next call is.
  await setReadAloud(organizer, true);
  await organizer.waitForTimeout(500);
  expect(await spoken(organizer)).toEqual([]);
  await organizer.getByRole("button", { name: "Done on Court 2" }).click();
  await expect.poll(() => spoken(organizer)).toEqual(["Court 2: Ana and Ben."]);
});
