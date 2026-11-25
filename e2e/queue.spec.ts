import { expect, test, type Page } from "@playwright/test";
import {
  addWalkIn,
  banner,
  court,
  endSession,
  onCourt,
  openPlayer,
  openTab,
  queueRows,
  queueSection,
  sessionTabs,
  startSession,
} from "./support/live";
import { signInWithNewClub } from "./support/organizer";

function liveLine(page: Page) {
  return page.getByText(/^Live · \d+ playing · \d+ in queue$/);
}

test.describe("queue engine, Courts and Queue tabs", () => {
  test("all off: 2 courts, 9 walk-ins, call, finish, pause, remove, end", async ({ page }) => {
    await signInWithNewClub(page, "alloff", "Makati Picklers");
    await startSession(page, "All Off Night", { courts: 2 });

    await expect(court(page, "Court 1").getByRole("button", { name: "Need 4 more" })).toBeVisible();
    const names = ["Ana", "Ben", "Carlo", "Dina", "Eli", "Fe", "Gil", "Hans", "Ivy"];
    for (const name of names) await addWalkIn(page, name);
    await expect(sessionTabs(page).getByRole("link", { name: /^Queue · 9/ })).toBeVisible();
    await expect(queueSection(page, "Up next").getByRole("listitem")).toHaveText([/1\s*Ana/, /2\s*Ben/, /3\s*Carlo/, /4\s*Dina/]);
    await expect(queueSection(page, "After that").getByRole("listitem")).toHaveCount(5);

    // BR7: each court calls the first 4 in queue order
    await openTab(page, "Courts");
    await expect(page.getByText("Up next:").filter({ visible: true })).toBeVisible();
    await court(page, "Court 1").getByRole("button", { name: "Call next 4" }).click();
    await expect(banner(page)).toHaveText(/Called to Court 1: Ana, Ben, Carlo, Dina/);
    await expect(onCourt(page, "Court 1")).toHaveText(["Ana", "Ben", "Carlo", "Dina"]);
    await expect(court(page, "Court 1").getByText(/^Doubles · \d+ min$/)).toBeVisible();
    await court(page, "Court 2").getByRole("button", { name: "Call next 4" }).click();
    await expect(banner(page)).toHaveText(/Called to Court 2: Eli, Fe, Gil, Hans/);
    await expect(liveLine(page)).toHaveText("Live · 8 playing · 1 in queue");

    // BR10: all four re-join the end; Court 1 calls Ivy and the first three of them
    await page.getByRole("button", { name: "Done on Court 1" }).click();
    await expect(banner(page)).toHaveText(/Game #1 on Court 1 is done\. Called: Ivy, Ana, Ben, Carlo/);
    await expect(onCourt(page, "Court 1")).toHaveText(["Ivy", "Ana", "Ben", "Carlo"]);

    // BR17: pause Dina from her sheet; she is skipped and keeps her place
    await openTab(page, "Queue");
    await expect(queueRows(page)).toHaveCount(1);
    await expect(queueRows(page)).toContainText("Dina");
    let sheet = await openPlayer(page, "Dina");
    await expect(sheet.getByText("#1 in queue · Not sure")).toBeVisible();
    await sheet.getByRole("button", { name: "Pause" }).click();
    await expect(banner(page)).toHaveText(/Dina is paused/);
    await expect(sheet).toBeHidden();
    await expect(queueSection(page, "On hold").getByRole("listitem")).toContainText("Resting");

    await openTab(page, "Courts");
    await page.getByRole("button", { name: "Done on Court 2" }).click();
    await expect(banner(page)).toHaveText(/Game #2 on Court 2 is done\. Called: Eli, Fe, Gil, Hans/);

    // BR18: remove Dina (with a confirm step)
    await openTab(page, "Queue");
    await expect(queueRows(page).first()).toContainText("Dina");
    sheet = await openPlayer(page, "Dina");
    await expect(sheet.getByRole("button", { name: "Resume" })).toBeVisible();
    await sheet.getByRole("button", { name: "Remove from queue" }).click();
    await expect(sheet.getByText("Remove Dina from the queue?")).toBeVisible();
    await sheet.getByRole("button", { name: "Yes, remove" }).click();
    await expect(banner(page)).toHaveText(/Dina was removed from the queue\./);
    await expect(page.getByText("Nobody in the queue.", { exact: false })).toBeVisible();
    await expect(sessionTabs(page).getByRole("link", { name: /^Queue · 0/ })).toBeVisible();

    // End the session (More › End session, with its confirm step)
    await endSession(page);
    await expect(page.getByRole("region", { name: "Court 1", exact: true })).toHaveCount(0);
  });

  test("winners stay: pick 2 winners; after 2 wins in a row all four go off", async ({ page }) => {
    await signInWithNewClub(page, "winners", "Pasig Dinkers");
    await startSession(page, "Winners Night", { courts: 1, winnersStay: true });
    for (const name of ["Ana", "Ben", "Carlo", "Dina", "Eli", "Fe"]) await addWalkIn(page, name);

    await openTab(page, "Courts");
    await court(page, "Court 1").getByRole("button", { name: "Call next 4" }).click();
    await expect(onCourt(page, "Court 1")).toHaveText(["Ana", "Ben", "Carlo", "Dina"]);

    // "Done" asks who won first
    await page.getByRole("button", { name: "Done on Court 1" }).click();
    const picker = court(page, "Court 1").getByRole("group", { name: "Who won?" });
    await expect(picker).toBeVisible();
    await expect(picker.getByRole("button", { name: "Confirm" })).toBeDisabled();
    await picker.getByRole("button", { name: "Carlo" }).click();
    await picker.getByRole("button", { name: "Ana" }).click();
    await picker.getByRole("button", { name: "Confirm" }).click();
    await expect(banner(page)).toHaveText(/Game #1 on Court 1 is done\. Won: Carlo and Ana\. Called: Ana, Carlo, Eli, Fe/);
    // The staying pair is listed first (on the left of the mini court).
    await expect(onCourt(page, "Court 1")).toHaveText(["Ana", "Carlo", "Eli", "Fe"]);
    await openTab(page, "Queue");
    await expect(queueRows(page)).toHaveText([/Ben/, /Dina/]);

    // Second win in a row: all four go off (winners first) and the next 4 are called
    await openTab(page, "Courts");
    await page.getByRole("button", { name: "Done on Court 1" }).click();
    await picker.getByRole("button", { name: "Ana" }).click();
    await picker.getByRole("button", { name: "Carlo" }).click();
    await picker.getByRole("button", { name: "Confirm" }).click();
    await expect(banner(page)).toHaveText(/Game #2 on Court 1 is done\. Won: Ana and Carlo\. Called: Ben, Dina, Ana, Carlo/);
    await openTab(page, "Queue");
    await expect(queueRows(page)).toHaveText([/Eli/, /Fe/]);

    await endSession(page);
  });

  test("NF9: an action in one browser shows in another within 2 seconds", async ({ page, browser }) => {
    await signInWithNewClub(page, "realtime", "Taguig Smashers");
    await startSession(page, "Realtime Night", { courts: 1 });
    const courtsUrl = page.url();

    // A second phone signed in as the same organizer, on the Queue tab.
    const other = await browser.newContext({ storageState: await page.context().storageState() });
    const second = await other.newPage();
    await second.goto(`${courtsUrl}/queue`);
    await expect(second.locator('[data-live-sync="connected"]')).toBeVisible();

    await addWalkIn(page, "Rita");
    await expect(queueRows(second).getByText("Rita")).toBeVisible({ timeout: 2_000 });

    for (const name of ["Sam", "Tess", "Uly"]) await addWalkIn(page, name);
    await expect(queueRows(second)).toHaveCount(4, { timeout: 2_000 });
    await openTab(page, "Courts");
    await court(page, "Court 1").getByRole("button", { name: "Call next 4" }).click();
    await openTab(second, "Courts");
    await expect(onCourt(second, "Court 1")).toHaveText(["Rita", "Sam", "Tess", "Uly"], { timeout: 2_000 });
    await expect(liveLine(second)).toHaveText("Live · 4 playing · 0 in queue", { timeout: 2_000 });

    // Losing the connection shows a notice; back online, it refetches what was missed.
    await openTab(second, "Queue");
    await other.setOffline(true);
    // NF10 (Phase 7): offline, the organizer's phone says taps will be saved.
    await expect(second.getByText("Offline — will save when signal returns").filter({ visible: true })).toBeVisible();
    await addWalkIn(page, "Vic");
    await other.setOffline(false);
    await expect(queueRows(second).getByText("Vic")).toBeVisible({ timeout: 15_000 });
    await expect(second.getByText("Connection lost.", { exact: false })).toBeHidden();
    await other.close();
  });

  test("QR page and the public /j link", async ({ page, browser }) => {
    await signInWithNewClub(page, "qr", "QC Paddlers");
    await startSession(page, "QR Night", { courts: 1 });
    await page.getByRole("link", { name: "Show QR" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "QR Night" })).toBeVisible();
    await expect(page.getByText("Scan to join").filter({ visible: true })).toBeVisible();
    await expect(page.getByRole("img", { name: /QR code/ }).locator("svg")).toBeVisible();
    for (const step of ["Open the phone's camera.", "Point it at the QR code.", "Tap the link that appears. No app needed."]) {
      await expect(page.getByText(step)).toBeVisible();
    }
    await expect(page.getByText("Or go to")).toBeVisible();
    const link = await page.getByText(/\/j\/[A-Z2-9]{6}$/).textContent();
    const code = link!.slice(-6);
    await expect(page.getByText(code, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Share link" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Print QR" })).toBeVisible();

    // The QR link is public: a signed-out phone sees the check-in form while live...
    const player = await (await browser.newContext()).newPage();
    await player.goto(`/j/${code}`);
    await expect(player.getByRole("heading", { level: 1, name: "QR Night" })).toBeVisible();
    await expect(player.getByRole("button", { name: "Join queue" })).toBeVisible();
    await player.goto("/j/ZZZZZZ");
    await expect(player.getByText("Check-in is closed.", { exact: false })).toBeVisible();

    // ...and "closed" once the session ends.
    await page.getByRole("link", { name: "Courts" }).click();
    await endSession(page);
    await player.goto(`/j/${code.toLowerCase()}`);
    await expect(player.getByText("Check-in is closed.", { exact: false })).toBeVisible();
  });
});
