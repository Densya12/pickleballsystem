import { expect, test, type Browser, type Page } from "@playwright/test";
import { addWalkIn, banner, court, endSession, onCourt, openTab, queueRows, QUEUE_URL, sessionTabs, SESSION_URL, startSession, finishGame } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

// Phase 5b (D18): fewer taps for a regular session.

async function phone(browser: Browser): Promise<Page> {
  return (await browser.newContext()).newPage();
}

/** Settings › Club QR code. */
async function openClubQr(organizer: Page) {
  await organizer.goto("/settings");
  await organizer.getByRole("link", { name: "Club QR code" }).click();
  await expect(organizer.getByRole("heading", { level: 1, name: "Club QR code" })).toBeVisible();
}

/** The club QR link ("QR link"), as a path. */
async function clubQrPath(organizer: Page): Promise<string> {
  const link = organizer.getByRole("region", { name: "Club QR code" }).getByText(/\/c\/[A-Z2-9]{6}(?:[A-Z2-9]{2})?$/);
  return new URL((await link.textContent())!).pathname;
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

  await openClubQr(organizer);
  const card = organizer.getByRole("region", { name: "Club QR code" });
  await expect(card.getByRole("img", { name: /Club QR code/ })).toBeVisible();
  const path = await clubQrPath(organizer);

  // Print QR: the print stylesheet keeps only the QR, the club name and "Scan to join".
  await card.getByRole("button", { name: "Print QR" }).click();
  expect(await organizer.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
  await organizer.emulateMedia({ media: "print" });
  await expect(card.getByRole("img", { name: /Club QR code/ })).toBeVisible();
  await expect(card.getByText("Pasig Paddlers", { exact: true })).toBeVisible();
  await expect(card.getByText("Scan to join")).toBeVisible();
  await expect(card.getByRole("button", { name: "Print QR" })).toBeHidden();
  await expect(card.getByText(path)).toBeHidden();
  await expect(organizer.getByRole("heading", { level: 1 }).getByText("Club QR code")).toBeHidden();
  await expect(organizer.getByRole("link", { name: "Settings" })).toBeHidden();
  await organizer.emulateMedia({ media: "screen" });
  await expect(card.getByText("Scan to join")).toBeHidden();

  // Nothing live yet.
  const player = await phone(browser);
  await player.goto(path);
  await expect(player.getByRole("heading", { level: 1, name: "Pasig Paddlers" })).toBeVisible();
  await expect(player.getByText("No open play right now.", { exact: false })).toBeVisible();

  // Live: the same QR opens the session's check-in.
  await organizer.goto("/");
  await startSession(organizer, "Saturday Open Play", { courts: 1 });
  await player.goto(path);
  await expect(player).toHaveURL(/\/j\/[A-Z2-9]{6}(?:[A-Z2-9]{2})?$/);
  await expect(player.getByRole("heading", { level: 1, name: "Saturday Open Play" })).toBeVisible();
  await expect(player.getByRole("button", { name: "Join queue" })).toBeVisible();

  // The session QR page points owners to the permanent one.
  await organizer.getByRole("link", { name: "Show QR" }).click();
  await organizer.getByRole("link", { name: "The club has a permanent QR" }).click();
  await expect(organizer.getByRole("heading", { level: 1, name: "Club QR code" })).toBeVisible();

  // Replace QR, behind a warning; the old code stops working.
  await card.getByRole("button", { name: "Replace QR" }).click();
  await expect(card.getByText("Printed copies will stop working.", { exact: false })).toBeVisible();
  await card.getByRole("button", { name: "Yes, replace" }).click();
  await expect(card.getByText("QR replaced. Print the new one.")).toBeVisible();
  await expect.poll(() => clubQrPath(organizer)).not.toBe(path);
  const newPath = await clubQrPath(organizer);
  await player.goto(path);
  await expect(player.getByText("This QR can't be found.", { exact: false })).toBeVisible();
  await player.goto(newPath);
  await expect(player.getByRole("heading", { level: 1, name: "Saturday Open Play" })).toBeVisible();
  await player.context().close();
});

test("Repeat last: the last session again in two taps", async ({ page: organizer }) => {
  await signInWithNewClub(organizer, "repeat", "Repeat Club");

  // Last week's session, with non-default settings, saved as a draft.
  await organizer.getByRole("link", { name: "New session" }).click();
  await organizer.getByLabel("Session name").fill("Friday Smash");
  await organizer.getByRole("button", { name: "More courts" }).click();
  await organizer.getByRole("group", { name: "Court 2" }).getByRole("radio", { name: "Singles" }).check();
  await organizer.getByRole("radio", { name: "15" }).check();
  await organizer.getByRole("radio", { name: /^Winners stay/ }).check();
  await organizer.getByRole("switch", { name: "Pay before queueing" }).check();
  await organizer.getByLabel("Fee per player (₱)").fill("200");
  // D25: a non-default preset too (the queue order the checks below expect).
  await organizer.getByRole("radio", { name: /^Fair line/ }).check();
  const startsAt = await organizer.getByLabel("Starts").inputValue();
  const endsAt = await organizer.getByLabel("Ends").inputValue();
  await organizer.getByRole("button", { name: "Save as draft" }).click();
  await expect(organizer.getByRole("heading", { level: 1, name: "Repeat Club" })).toBeVisible();

  // Tap 1: Repeat last. Everything is filled in (the start time hasn't passed, so: today).
  await organizer.getByRole("link", { name: "Repeat last: Friday Smash" }).click();
  await expect(organizer.getByText("Copied from Friday Smash.", { exact: false })).toBeVisible();
  await expect(organizer.getByLabel("Session name")).toHaveValue("Friday Smash");
  await expect(organizer.getByLabel("Starts")).toHaveValue(startsAt);
  await expect(organizer.getByLabel("Ends")).toHaveValue(endsAt);
  await expect(organizer.getByText("3 courts", { exact: true })).toBeVisible();
  await expect(organizer.getByRole("group", { name: "Court 2" }).getByRole("radio", { name: "Singles" })).toBeChecked();
  await expect(organizer.getByRole("group", { name: "Court 3" }).getByRole("radio", { name: "Doubles" })).toBeChecked();
  await expect(organizer.getByRole("radio", { name: "15" })).toBeChecked();
  await expect(organizer.getByRole("radio", { name: /^Winners stay/ })).toBeChecked();
  await expect(organizer.getByRole("switch", { name: "Pay before queueing" })).toBeChecked();
  await expect(organizer.getByLabel("Fee per player (₱)")).toHaveValue("200");
  await expect(organizer.getByRole("radio", { name: /^Fair line/ })).toBeChecked();

  // Tap 2: Start session.
  await organizer.getByRole("button", { name: "Start session" }).click();
  await expect(organizer).toHaveURL(SESSION_URL);
  await expect(organizer.getByRole("heading", { level: 1, name: "Friday Smash" })).toBeVisible();
  await expect(organizer.getByRole("heading", { level: 2, name: /^Court \d$/ })).toHaveCount(3);
  await expect(court(organizer, "Court 2")).toContainText("Singles · Empty");
  await expect(sessionTabs(organizer).getByRole("link", { name: "Payments" })).toBeVisible();
});

test("Undo: finishing a game by mistake is undone and the queue is back as before", async ({ page: organizer }) => {
  await signInWithNewClub(organizer, "undo", "Undo Club");
  await startSession(organizer, "Undo Night", { courts: 1 });
  for (const name of ["Aldo", "Bea", "Cris", "Dani", "Ella", "Fely"]) await addWalkIn(organizer, name);

  await openTab(organizer, "Courts");
  await court(organizer, "Court 1").getByRole("button", { name: "Call next 4" }).click();
  await expect(onCourt(organizer, "Court 1")).toHaveText(["Aldo", "Bea", "Cris", "Dani"]);
  await expect(organizer.getByText("Up next:").filter({ visible: true }).locator("..")).toContainText("Ella, Fely");

  await finishGame(organizer, "Court 1");
  await expect(banner(organizer)).toContainText("Game #1 on Court 1 is done.");
  await expect(onCourt(organizer, "Court 1")).toHaveText(["Ella", "Fely", "Aldo", "Bea"]);

  const undo = organizer.getByRole("button", { name: /^Undo \(\d+s\)$/ });
  await expect(undo).toBeVisible();
  await undo.click();
  await expect(banner(organizer)).toHaveText(/Game #1 on Court 1 is back on\. Keep playing\./);
  await expect(undo).toHaveCount(0);
  await expect(onCourt(organizer, "Court 1")).toHaveText(["Aldo", "Bea", "Cris", "Dani"]);
  await openTab(organizer, "Queue");
  await expect(queueRows(organizer)).toHaveText([/1\s*Ella/, /2\s*Fely/]);

  // The game finishes normally afterwards.
  await openTab(organizer, "Courts");
  await finishGame(organizer, "Court 1");
  await expect(banner(organizer)).toContainText("Game #1 on Court 1 is done.");
});

test("a returning player checks in with one tap: Join as …", async ({ page: organizer, browser }) => {
  test.setTimeout(90_000);
  await signInWithNewClub(organizer, "returning", "Balik Club");
  await openClubQr(organizer);
  const path = await clubQrPath(organizer);
  await organizer.goto("/");

  // Last week: Rina checks in by the club QR.
  await startSession(organizer, "Last Week", { courts: 1 });
  const player = await phone(browser);
  await player.goto(path);
  await expect(player.getByRole("heading", { level: 1, name: "Last Week" })).toBeVisible();
  await player.getByLabel("Name", { exact: true }).fill("Rina Reyes");
  await player.getByRole("radio", { name: "Level 3" }).check();
  await player.getByRole("button", { name: "Join queue" }).click();
  await expect(player.getByRole("heading", { level: 1, name: "Hi, Rina" })).toBeVisible();
  await endSession(organizer);

  // This week: same phone, same QR. One tap (payment details are on My place after joining, QA-06).
  await organizer.goto("/");
  await startSession(organizer, "This Week", { courts: 1 });
  await player.goto(path);
  await expect(player.getByRole("heading", { level: 1, name: "This Week" })).toBeVisible();
  await expect(player.getByText("Level 3")).toBeAttached();
  await expect(player.getByLabel("Name", { exact: true })).toHaveCount(0);
  await expect(player.getByRole("heading", { name: "Payment" })).toHaveCount(0);
  await expect(player.getByRole("button", { name: "Not Rina Reyes?" })).toBeVisible();
  await player.getByRole("button", { name: "Join as Rina Reyes" }).click();
  await expect(player.getByRole("heading", { level: 1, name: "Hi, Rina" })).toBeVisible();
  await openTab(organizer, "Queue");
  await expect(queueRows(organizer).getByRole("button", { name: /Rina Reyes/ })).toContainText("Level 3", { timeout: 5_000 });
  await player.context().close();
});

test("a walk-in can't be added without a payment choice", async ({ page: organizer }) => {
  await signInWithNewClub(organizer, "walkinpay", "Walk Club");
  await startSession(organizer, "Walk Night", { courts: 1 });

  await organizer.getByRole("link", { name: "Walk-in" }).click();
  await organizer.getByLabel("Name", { exact: true }).fill("Tito Boy");
  const payment = organizer.getByRole("group", { name: "Payment · ₱150" });
  for (const choice of ["Paid cash", "GCash", "Pay later"]) {
    await expect(payment.getByRole("radio", { name: choice })).not.toBeChecked();
  }
  await organizer.getByRole("button", { name: "Add to queue" }).click();
  await expect(payment).toHaveAccessibleDescription("Choose how they'll pay.");
  await expect(organizer.getByRole("heading", { level: 1, name: "Add walk-in" })).toBeVisible();

  await payment.getByRole("radio", { name: "Paid cash" }).check();
  await expect(organizer.getByText("Choose how they'll pay.")).toHaveCount(0);
  await organizer.getByRole("button", { name: "Add to queue" }).click();
  await expect(organizer).toHaveURL(QUEUE_URL);
  await expect(banner(organizer)).toContainText("Tito Boy is in the queue");
  await openTab(organizer, "Payments");
  await expect(organizer.getByTestId("payment-counts")).toHaveText("1 paid · 0 to check · 0 unpaid · ₱150 each");
});
