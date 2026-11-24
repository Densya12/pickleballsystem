import { expect, test, type Browser, type Page } from "@playwright/test";
import { addWalkIn, court, onCourt, queue, SESSION_URL, startSession } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

// Phase 6: Mga court view (D14, BR21) and Tagatawag (D17).

async function phone(browser: Browser): Promise<Page> {
  return (await browser.newContext()).newPage();
}

async function joinPath(organizer: Page): Promise<string> {
  await organizer.getByRole("link", { name: "Ipakita ang QR" }).click();
  const path = new URL((await organizer.getByText(/\/j\/[A-Z2-9]{6}$/).textContent())!).pathname;
  await organizer.getByRole("link", { name: "Bumalik" }).click();
  await expect(organizer).toHaveURL(SESSION_URL);
  return path;
}

function courtsRegion(player: Page, label: string) {
  return player.getByRole("region", { name: label });
}

test("Mga court: who plays, who's next, holds, and 'Ikaw', live within 2 seconds", async ({ page: organizer, browser }) => {
  test.setTimeout(90_000);
  await signInWithNewClub(organizer, "courtsview", "Courts Club");
  await organizer.getByRole("link", { name: "Bagong open play" }).click();
  await organizer.getByLabel("Pangalan ng session").fill("Courts Night");
  await organizer.getByRole("group", { name: "Court 2" }).getByRole("radio", { name: "Singles" }).check();
  await organizer.getByRole("switch", { name: "Bayad muna bago pumila" }).check();
  await organizer.getByRole("button", { name: "Simulan ang session" }).click();
  await expect(organizer).toHaveURL(SESSION_URL);

  for (const name of ["Paid One", "Paid Two", "Paid Three", "Paid Four"]) {
    await addWalkIn(organizer, name, "Beginner", { choice: "Nagbayad ng cash" });
  }
  await addWalkIn(organizer, "Unpaid Uno", "Beginner", { choice: "Mamaya na magbabayad" });
  const path = await joinPath(organizer);

  // Mia checks in with GCash (pending counts as paid, BR14) and opens Mga court.
  const mia = await phone(browser);
  await mia.goto(path);
  await mia.getByLabel("Pangalan mo").fill("Phone Mia");
  await mia.getByLabel("GCash reference number").fill("9876 5432 10");
  await mia.getByRole("button", { name: "Pumila na" }).click();
  await expect(mia.getByRole("heading", { level: 1, name: "Hi, Phone Mia!" })).toBeVisible();
  await mia.getByRole("link", { name: "Tingnan ang mga court" }).click();
  await expect(mia.getByRole("heading", { level: 1, name: "Mga court" })).toBeVisible();
  await expect(mia.locator('[data-live-sync="connected"]').filter({ visible: true })).toHaveCount(1);

  await expect(courtsRegion(mia, "Court 1")).toContainText("Doubles");
  await expect(courtsRegion(mia, "Court 1")).toContainText("Bakante");
  await expect(courtsRegion(mia, "Court 2")).toContainText("Singles");
  const ready = mia.getByRole("region", { name: "Maghanda na" }).getByRole("listitem");
  await expect(ready).toHaveText(["Pang-1.Paid One", "Pang-2.Paid Two", "Pang-3.Paid Three", "Pang-4.Paid Four"]);
  // Mia is the 5th eligible: "Susunod pagkatapos", marked as herself.
  const after = mia.getByRole("region", { name: "Susunod pagkatapos" }).getByRole("listitem");
  await expect(after).toHaveText(["Pang-1.Phone MiaIkaw"]);
  await expect(mia.locator("[data-me]")).toHaveText(["Phone MiaIkaw"]);
  // pay_first: the unpaid walk-in is held.
  const waiting = mia.getByRole("region", { name: "Hindi pa matatawag" }).getByRole("listitem");
  await expect(waiting).toHaveText(["Unpaid Unobayad muna"]);

  // A pause shows up live, and Mia moves into "Maghanda na".
  await queue(organizer).getByRole("button", { name: /Paid Four/ }).click();
  await organizer.getByRole("button", { name: "I-pause" }).click();
  // In queue order.
  await expect(waiting).toHaveText(["Paid Fournagpapahinga", "Unpaid Unobayad muna"], { timeout: 2_000 });
  await expect(ready).toHaveText(["Pang-1.Paid One", "Pang-2.Paid Two", "Pang-3.Paid Three", "Pang-4.Phone MiaIkaw"]);

  // The organizer calls Court 1: Mia's phone shows the game and "Ikaw na!" within 2 seconds.
  await court(organizer, "Court 1").getByRole("button", { name: "Tawagin ang susunod" }).click();
  await expect(onCourt(organizer, "Court 1")).toHaveText(["Paid One", "Paid Two", "Paid Three", "Phone Mia"]);
  await expect(courtsRegion(mia, "Court 1")).toContainText("Laro #1", { timeout: 2_000 });
  await expect(courtsRegion(mia, "Court 1").getByRole("listitem")).toHaveText(["Paid One", "Paid Two", "Paid Three", "Phone MiaIkaw"]);
  const called = mia.getByRole("alert").filter({ hasText: "Ikaw na" });
  await expect(called).toContainText("Ikaw na, Phone Mia!");
  await expect(mia.getByRole("region", { name: "Maghanda na" })).toContainText("Wala pang nakapila.");

  // Papunta na ako, then back to Pwesto, which remembers it.
  await mia.getByRole("button", { name: "Papunta na ako" }).click();
  await expect(called).toHaveCount(0);
  await mia.getByRole("link", { name: "Bumalik sa pwesto ko" }).click();
  await expect(mia.getByRole("heading", { level: 1, name: "Naglalaro ka sa Court 1" })).toBeVisible();
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

test("Tagatawag reads each new call once, and stays silent when off (also after a reload)", async ({ page: organizer }) => {
  test.setTimeout(90_000);
  await stubSpeech(organizer);
  await signInWithNewClub(organizer, "tagatawag", "Tawag Club");
  await startSession(organizer, "Tawag Night", { courts: 2, formats: ["Doubles", "Singles"] });
  for (const name of ["Ana", "Ben", "Carlo", "Dina", "Ella", "Fely", "Gino", "Hana"]) await addWalkIn(organizer, name);

  const toggle = organizer.getByRole("switch", { name: "Tagatawag (basahin nang malakas ang tawag)" });
  await expect(toggle).toBeChecked(); // default ON
  expect(await spoken(organizer)).toEqual([]);

  // call_next on doubles, then on singles.
  await court(organizer, "Court 1").getByRole("button", { name: "Tawagin ang susunod" }).click();
  await expect.poll(() => spoken(organizer)).toEqual(["Court 1: Ana, Ben, Carlo, at Dina."]);
  await court(organizer, "Court 2").getByRole("button", { name: "Tawagin ang susunod" }).click();
  await expect.poll(() => spoken(organizer)).toEqual(["Court 1: Ana, Ben, Carlo, at Dina.", "Court 2: Ella at Fely."]);

  // The automatic call after finish_game is read too, once.
  await court(organizer, "Court 1").getByRole("button", { name: "Tapos na · tawagin ang susunod" }).click();
  await expect.poll(() => spoken(organizer)).toHaveLength(3);
  expect((await spoken(organizer))[2]).toBe("Court 1: Gino, Hana, Ana, at Ben.");
  await organizer.waitForTimeout(1_500);
  expect(await spoken(organizer)).toHaveLength(3);

  // Off: silent.
  await toggle.uncheck();
  await court(organizer, "Court 2").getByRole("button", { name: "Tapos na · tawagin ang susunod" }).click();
  await expect(onCourt(organizer, "Court 2")).toHaveText(["Carlo", "Dina"]);
  await organizer.waitForTimeout(1_000);
  expect(await spoken(organizer)).toHaveLength(3);

  // Still off after a reload (remembered on this device), and the games on court aren't replayed.
  await organizer.reload();
  await expect(toggle).not.toBeChecked();
  await court(organizer, "Court 1").getByRole("button", { name: "Tapos na · tawagin ang susunod" }).click();
  await expect(onCourt(organizer, "Court 1")).toHaveText(["Ella", "Fely", "Gino", "Hana"]);
  await organizer.waitForTimeout(1_000);
  expect(await spoken(organizer)).toEqual([]);

  // On again: nothing old is read; the next call is.
  await toggle.check();
  await organizer.waitForTimeout(500);
  expect(await spoken(organizer)).toEqual([]);
  await court(organizer, "Court 2").getByRole("button", { name: "Tapos na · tawagin ang susunod" }).click();
  await expect.poll(() => spoken(organizer)).toEqual(["Court 2: Ana at Ben."]);
});
