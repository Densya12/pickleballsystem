import { expect, test } from "@playwright/test";
import { addWalkIn, banner, court, onCourt, queue, startSession } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

// NF10: organizer taps without signal wait in the outbox and are applied once, in order.

test("offline: a finished game and a walk-in are saved, then applied exactly once", async ({ page, context }) => {
  test.setTimeout(90_000);
  await signInWithNewClub(page, "offline", "Offline Club");
  await startSession(page, "Offline Night", { courts: 1 });
  for (const name of ["Aldo", "Bea", "Cris", "Dani", "Ella", "Fely"]) await addWalkIn(page, name);
  await court(page, "Court 1").getByRole("button", { name: "Tawagin ang susunod" }).click();
  await expect(onCourt(page, "Court 1")).toHaveText(["Aldo", "Bea", "Cris", "Dani"]);

  // The walk-in page is open when the signal drops.
  await page.getByRole("link", { name: "Walk-in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Magdagdag ng walk-in" })).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText("Offline — ise-save pagbalik ng signal.")).toBeVisible();
  await page.getByLabel("Pangalan", { exact: true }).fill("Offline Olive");
  await page.getByRole("radio", { name: "Mamaya na magbabayad" }).check();
  await page.getByRole("button", { name: "Ilagay sa pila" }).click();

  // Back on Live: offline banner, and the walk-in is waiting.
  await expect(page.getByRole("heading", { level: 1, name: "Offline Night" })).toBeVisible();
  await expect(page.getByText("Offline — ise-save pagbalik ng signal", { exact: true })).toBeVisible();
  const waiting = page.getByRole("region", { name: "Hinihintay ang signal" });
  await expect(waiting.getByRole("listitem")).toHaveText(["Walk-in: Offline Olive"]);

  // Finish the game offline: it waits too, and the court shows it.
  await court(page, "Court 1").getByRole("button", { name: "Tapos na · tawagin ang susunod" }).click();
  await expect(waiting.getByRole("listitem")).toHaveText(["Walk-in: Offline Olive", "Tapos na: Laro #1 sa Court 1"]);
  await expect(court(page, "Court 1")).toContainText("Hinihintay ang signal");
  await expect(court(page, "Court 1").getByRole("button", { name: "Tapos na · tawagin ang susunod" })).toBeDisabled();

  // Ending the session and Ibalik need the internet.
  await page.getByRole("button", { name: "Tapusin ang session" }).click();
  await page.getByRole("button", { name: "Oo, tapusin" }).click();
  await expect(page.getByText("Kailangan ng internet para dito.")).toBeVisible();
  await page.getByRole("button", { name: "Huwag muna" }).click();

  // Signal back: both are sent, in order, once.
  await context.setOffline(false);
  await expect(waiting).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByText("Offline — ise-save pagbalik ng signal", { exact: true })).toHaveCount(0);
  await expect(court(page, "Court 1")).toContainText("Laro #2", { timeout: 5_000 });
  // The walk-in went in first, so after the finish the queue is: Ella, Fely, Olive, then Aldo..Dani re-joined.
  await expect(onCourt(page, "Court 1")).toHaveText(["Ella", "Fely", "Offline Olive", "Aldo"]);
  await expect(queue(page).getByRole("listitem")).toHaveText([/Bea/, /Cris/, /Dani/]);

  // A reload shows the same: one Olive, one finished game.
  await page.reload();
  await expect(court(page, "Court 1")).toContainText("Laro #2");
  await expect(page.getByText("Offline Olive", { exact: true })).toHaveCount(1);
  await expect(banner(page)).toHaveCount(0);
});
