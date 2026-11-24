import { expect, test, type Browser, type Page } from "@playwright/test";
import { addWalkIn, banner, court, onCourt, queue, SESSION_URL, startSession } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

// Phase 5b (D18): fewer taps for a regular session.

async function phone(browser: Browser): Promise<Page> {
  return (await browser.newContext()).newPage();
}

/** The club QR link from Settings ("Link ng QR"), as a path. */
async function clubQrPath(organizer: Page): Promise<string> {
  const link = organizer.getByRole("region", { name: "QR ng club" }).getByText(/\/c\/[A-Z2-9]{6}$/);
  return new URL((await link.textContent())!).pathname;
}

async function endSession(organizer: Page) {
  await organizer.getByRole("button", { name: "Tapusin ang session" }).click();
  await organizer.getByRole("button", { name: "Oo, tapusin" }).click();
  await expect(organizer.getByRole("button", { name: "Tapusin ang session" })).toHaveCount(0);
}

test("club QR: prints, opens the live session, says when nothing is live, and can be replaced", async ({ page: organizer, browser }) => {
  test.setTimeout(90_000);
  // Count print() calls instead of opening the print dialog.
  await organizer.addInitScript(() => {
    (window as unknown as { printed: number }).printed = 0;
    window.print = () => {
      (window as unknown as { printed: number }).printed += 1;
    };
  });
  await signInWithNewClub(organizer, "clubqr", "Pasig Paddlers");

  await organizer.getByRole("link", { name: "Settings ng club" }).click();
  const card = organizer.getByRole("region", { name: "QR ng club" });
  await expect(card.getByRole("img", { name: /QR code ng club/ })).toBeVisible();
  const path = await clubQrPath(organizer);

  // I-print ang QR: the print stylesheet keeps only the QR, the club name and "I-scan para pumila".
  await card.getByRole("button", { name: "I-print ang QR" }).click();
  expect(await organizer.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
  await organizer.emulateMedia({ media: "print" });
  await expect(card.getByRole("img", { name: /QR code ng club/ })).toBeVisible();
  await expect(card.getByText("Pasig Paddlers", { exact: true })).toBeVisible();
  await expect(card.getByText("I-scan para pumila")).toBeVisible();
  await expect(card.getByRole("button", { name: "I-print ang QR" })).toBeHidden();
  await expect(card.getByText(path)).toBeHidden();
  await expect(organizer.getByRole("heading", { name: "Settings ng club" })).toBeHidden();
  // (Earlier pages stay in the DOM, hidden; check every match.)
  for (const field of await organizer.getByLabel("Pangalan ng club").all()) await expect(field).toBeHidden();
  await expect(organizer.getByRole("heading", { name: "Mga organizer" })).toBeHidden();
  await expect(organizer.getByRole("button", { name: "I-save" })).toBeHidden();
  await organizer.emulateMedia({ media: "screen" });
  await expect(card.getByText("I-scan para pumila")).toBeHidden();

  // Nothing live yet.
  const player = await phone(browser);
  await player.goto(path);
  await expect(player.getByRole("heading", { level: 1, name: "Pasig Paddlers" })).toBeVisible();
  await expect(player.getByText("Wala pang open play ngayon.")).toBeVisible();

  // Live: the same QR opens the session's check-in.
  await organizer.getByRole("link", { name: "Bumalik" }).click();
  await startSession(organizer, "Sabado Open Play", { courts: 1 });
  await player.goto(path);
  await expect(player).toHaveURL(/\/j\/[A-Z2-9]{6}$/);
  await expect(player.getByRole("heading", { level: 1, name: "Sabado Open Play" })).toBeVisible();
  await expect(player.getByRole("button", { name: "Pumila na" })).toBeVisible();

  // The session QR page points owners to the permanent one.
  await organizer.getByRole("link", { name: "Ipakita ang QR" }).click();
  await organizer.getByRole("link", { name: "May permanenteng QR ang club" }).click();
  await expect(organizer.getByRole("heading", { level: 1, name: "Settings ng club" })).toBeVisible();

  // Palitan ang QR, behind a warning; the old code stops working.
  await card.getByRole("button", { name: "Palitan ang QR" }).click();
  await expect(card.getByText("Hindi na gagana ang mga naka-print na QR.", { exact: false })).toBeVisible();
  await card.getByRole("button", { name: "Oo, palitan" }).click();
  await expect(card.getByRole("status")).toHaveText("Napalitan na ang QR. I-print ang bago.");
  await expect.poll(() => clubQrPath(organizer)).not.toBe(path);
  const newPath = await clubQrPath(organizer);
  await player.goto(path);
  await expect(player.getByText("Hindi makita ang QR na ito.", { exact: false })).toBeVisible();
  await player.goto(newPath);
  await expect(player.getByRole("heading", { level: 1, name: "Sabado Open Play" })).toBeVisible();
  await player.context().close();
});

test("Ulitin: the last session again in two taps", async ({ page: organizer }) => {
  await signInWithNewClub(organizer, "ulitin", "Ulit Club");

  // Last week's session, with non-default settings, saved as a draft.
  await organizer.getByRole("link", { name: "Bagong open play" }).click();
  await organizer.getByLabel("Pangalan ng session").fill("Friday Smash");
  await organizer.getByRole("button", { name: "Dagdag" }).click();
  await organizer.getByRole("group", { name: "Court 2" }).getByRole("radio", { name: "Singles" }).check();
  await organizer.getByRole("radio", { name: "15" }).check();
  await organizer.getByText("Mananatili ang nanalo").click();
  await organizer.getByRole("switch", { name: "Bayad muna bago pumila" }).check();
  await organizer.getByLabel("Bayad bawat player (₱)").fill("200");
  const startsAt = await organizer.getByLabel("Simula").inputValue();
  const endsAt = await organizer.getByLabel("Tapos").inputValue();
  await organizer.getByRole("button", { name: "I-save muna" }).click();
  await expect(organizer.getByRole("heading", { level: 1, name: "Ulit Club" })).toBeVisible();

  // Tap 1: Ulitin. Everything is filled in (the start time hasn't passed, so: today).
  await organizer.getByRole("link", { name: "Ulitin: Friday Smash" }).click();
  await expect(organizer.getByText("Kinopya mula sa Friday Smash.", { exact: false })).toBeVisible();
  await expect(organizer.getByLabel("Pangalan ng session")).toHaveValue("Friday Smash");
  await expect(organizer.getByLabel("Simula")).toHaveValue(startsAt);
  await expect(organizer.getByLabel("Tapos")).toHaveValue(endsAt);
  await expect(organizer.getByText("3 courts", { exact: true })).toBeVisible();
  await expect(organizer.getByRole("group", { name: "Court 2" }).getByRole("radio", { name: "Singles" })).toBeChecked();
  await expect(organizer.getByRole("group", { name: "Court 3" }).getByRole("radio", { name: "Doubles" })).toBeChecked();
  await expect(organizer.getByRole("radio", { name: "15" })).toBeChecked();
  await expect(organizer.getByRole("radio", { name: /Mananatili ang nanalo/ })).toBeChecked();
  await expect(organizer.getByRole("switch", { name: "Bayad muna bago pumila" })).toBeChecked();
  await expect(organizer.getByLabel("Bayad bawat player (₱)")).toHaveValue("200");

  // Tap 2: Simulan.
  await organizer.getByRole("button", { name: "Simulan ang session" }).click();
  await expect(organizer).toHaveURL(SESSION_URL);
  await expect(organizer.getByRole("heading", { level: 1, name: "Friday Smash" })).toBeVisible();
  await expect(organizer.getByText(/· 3 courts$/).filter({ visible: true })).toHaveCount(1);
  await expect(court(organizer, "Court 2")).toContainText("Singles");
  await expect(organizer.getByRole("link", { name: /Bayad 0\/0/ })).toBeVisible();
});

test("Ibalik: finishing a game by mistake is undone and the queue is back as before", async ({ page: organizer }) => {
  await signInWithNewClub(organizer, "undo", "Undo Club");
  await startSession(organizer, "Undo Night", { courts: 1 });
  for (const name of ["Aldo", "Bea", "Cris", "Dani", "Ella", "Fely"]) await addWalkIn(organizer, name);

  await court(organizer, "Court 1").getByRole("button", { name: "Tawagin ang susunod" }).click();
  await expect(onCourt(organizer, "Court 1")).toHaveText(["Aldo", "Bea", "Cris", "Dani"]);
  const queueBefore = await queue(organizer).getByRole("listitem").allTextContents();
  expect(queueBefore).toHaveLength(2);

  await court(organizer, "Court 1").getByRole("button", { name: "Tapos na · tawagin ang susunod" }).click();
  await expect(banner(organizer)).toContainText("Tapos ang Laro #1 sa Court 1.");
  await expect(onCourt(organizer, "Court 1")).toHaveText(["Ella", "Fely", "Aldo", "Bea"]);

  const undo = organizer.getByRole("button", { name: /^Ibalik \(\d+s\)$/ });
  await expect(undo).toBeVisible();
  await undo.click();
  await expect(banner(organizer)).toHaveText(/Naibalik ang Laro #1 sa Court 1\. Tuloy pa ang laro\./);
  await expect(undo).toHaveCount(0);
  await expect(onCourt(organizer, "Court 1")).toHaveText(["Aldo", "Bea", "Cris", "Dani"]);
  await expect(queue(organizer).getByRole("listitem")).toHaveText(queueBefore);

  // The game finishes normally afterwards.
  await court(organizer, "Court 1").getByRole("button", { name: "Tapos na · tawagin ang susunod" }).click();
  await expect(banner(organizer)).toContainText("Tapos ang Laro #1 sa Court 1.");
});

test("a returning player checks in with one tap: Pumila bilang …", async ({ page: organizer, browser }) => {
  test.setTimeout(90_000);
  await signInWithNewClub(organizer, "returning", "Balik Club");
  await organizer.getByRole("link", { name: "Settings ng club" }).click();
  const path = await clubQrPath(organizer);
  await organizer.getByRole("link", { name: "Bumalik" }).click();

  // Last week: Rina checks in by the club QR.
  await startSession(organizer, "Last Week", { courts: 1 });
  const player = await phone(browser);
  await player.goto(path);
  await expect(player.getByRole("heading", { level: 1, name: "Last Week" })).toBeVisible();
  await player.getByLabel("Pangalan mo").fill("Rina Reyes");
  await player.getByRole("radio", { name: "Intermediate" }).check();
  await player.getByRole("switch", { name: "Cash ang ibabayad ko" }).check();
  await player.getByRole("button", { name: "Pumila na" }).click();
  await expect(player.getByRole("heading", { level: 1, name: "Hi, Rina Reyes!" })).toBeVisible();
  await endSession(organizer);

  // This week: same phone, same QR. One tap (plus the payment choice, since there's a fee).
  await organizer.goto("/");
  await startSession(organizer, "This Week", { courts: 1 });
  await player.goto(path);
  await expect(player.getByRole("heading", { level: 1, name: "This Week" })).toBeVisible();
  await expect(player.getByText("Intermediate")).toBeVisible();
  await expect(player.getByLabel("Pangalan mo")).toHaveCount(0);
  await expect(player.getByRole("heading", { name: "Bayad · ₱150" })).toBeVisible();
  await expect(player.getByRole("button", { name: "Hindi ako si Rina Reyes" })).toBeVisible();
  await player.getByRole("switch", { name: "Cash ang ibabayad ko" }).check();
  await player.getByRole("button", { name: "Pumila bilang Rina Reyes" }).click();
  await expect(player.getByRole("heading", { level: 1, name: "Hi, Rina Reyes!" })).toBeVisible();
  await expect(queue(organizer).getByRole("button", { name: /Rina Reyes/ })).toContainText("Intermediate", { timeout: 5_000 });
  await player.context().close();
});

test("a walk-in can't be added without a payment choice", async ({ page: organizer }) => {
  await signInWithNewClub(organizer, "walkinpay", "Walk Club");
  await startSession(organizer, "Walk Night", { courts: 1 });

  await organizer.getByRole("link", { name: "Walk-in" }).click();
  await organizer.getByLabel("Pangalan", { exact: true }).fill("Tito Boy");
  const payment = organizer.getByRole("group", { name: "Bayad · ₱150" });
  for (const choice of ["Nagbayad ng cash", "GCash", "Mamaya na magbabayad"]) {
    await expect(payment.getByRole("radio", { name: choice })).not.toBeChecked();
  }
  await organizer.getByRole("button", { name: "Ilagay sa pila" }).click();
  await expect(payment).toHaveAccessibleDescription("Pumili kung paano magbabayad.");
  await expect(organizer.getByRole("heading", { level: 1, name: "Magdagdag ng walk-in" })).toBeVisible();

  await payment.getByRole("radio", { name: "Nagbayad ng cash" }).check();
  await expect(organizer.getByText("Pumili kung paano magbabayad.")).toHaveCount(0);
  await organizer.getByRole("button", { name: "Ilagay sa pila" }).click();
  await expect(organizer).toHaveURL(SESSION_URL);
  await expect(banner(organizer)).toContainText("Nasa pila na si Tito Boy");
  await expect(organizer.getByRole("link", { name: /Bayad 1\/1/ })).toBeVisible();
});
