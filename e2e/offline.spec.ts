import { expect, test } from "@playwright/test";
import { addWalkIn, banner, court, endSession, onCourt, openMore, openTab, queueRows, startSession } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

// NF10: organizer taps without signal wait in the outbox and are applied once, in order.

test("offline: a finished game and a walk-in are saved, then applied exactly once", async ({ page, context }) => {
  test.setTimeout(90_000);
  await signInWithNewClub(page, "offline", "Offline Club");
  await startSession(page, "Offline Night", { courts: 1 });
  for (const name of ["Aldo", "Bea", "Cris", "Dani", "Ella", "Fely"]) await addWalkIn(page, name);
  await openTab(page, "Courts");
  await court(page, "Court 1").getByRole("button", { name: "Call next 4" }).click();
  await expect(onCourt(page, "Court 1")).toHaveText(["Aldo", "Bea", "Cris", "Dani"]);

  // The walk-in page is open when the signal drops.
  await page.getByRole("link", { name: "Walk-in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Add walk-in" })).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText("Offline — will save when signal returns")).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill("Offline Olive");
  await page.getByRole("radio", { name: "Pay later" }).check();
  await page.getByRole("button", { name: "Add to queue" }).click();

  // Back on Courts (the page in memory): offline banner, and the walk-in is waiting.
  await expect(page.getByRole("heading", { level: 1, name: "Offline Night" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("status").filter({ hasText: "Offline — will save when signal returns" })).toBeVisible();
  const waiting = page.getByRole("region", { name: "Waiting for signal" });
  await expect(waiting.getByRole("listitem")).toHaveText(["Walk-in: Offline Olive"]);

  // Finish the game offline: it waits too, and the court shows it.
  await page.getByRole("button", { name: "Done on Court 1" }).click();
  await expect(waiting.getByRole("listitem")).toHaveText(["Walk-in: Offline Olive", "Done: Game #1 on Court 1"]);
  await expect(court(page, "Court 1")).toContainText("Waiting for signal");
  await expect(page.getByRole("button", { name: "Done on Court 1" })).toBeDisabled();

  // Ending the session needs the internet.
  const more = await openMore(page);
  await more.getByRole("button", { name: "End session" }).click();
  await more.getByRole("button", { name: "Yes, end it" }).click();
  await expect(more.getByText("This needs the internet.")).toBeVisible();
  await more.getByRole("button", { name: "Keep going" }).click();
  await page.keyboard.press("Escape");

  // Signal back: both are sent, in order, once.
  await context.setOffline(false);
  await expect(waiting).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByRole("status").filter({ hasText: "Offline — will save when signal returns" })).toHaveCount(0);
  // The walk-in went in first, so after the finish the queue is: Ella, Fely, Olive, then Aldo..Dani re-joined.
  await expect(onCourt(page, "Court 1")).toHaveText(["Ella", "Fely", "Offline Olive", "Aldo"], { timeout: 5_000 });
  await openTab(page, "Queue");
  await expect(queueRows(page)).toHaveText([/Bea/, /Cris/, /Dani/]);

  // A reload shows the same: one Olive, one finished game.
  await openTab(page, "Courts");
  await page.reload();
  await expect(onCourt(page, "Court 1")).toHaveText(["Ella", "Fely", "Offline Olive", "Aldo"]);
  await expect(page.getByText("Offline Olive", { exact: true })).toHaveCount(1);
  await expect(banner(page)).toHaveCount(0);
  await endSession(page);
});
