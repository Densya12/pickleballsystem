import { expect, test } from "@playwright/test";
import { addWalkIn, banner, court, onCourt, openTab, queueRows, startSession, finishGame } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

// QA-03 / D23: Winners stay with fewer than 2 waiting. Everyone goes off with the
// losers first, so a winner sits out instead of the same pair playing every game.

test("winners stay, 5 players on doubles: the waiting player, both losers and one winner play next", async ({ page }) => {
  test.setTimeout(90_000);
  await signInWithNewClub(page, "d23", "D23 Club");
  await startSession(page, "D23 Night", { courts: 1, winnersStay: true });
  for (const name of ["Ana", "Ben", "Carlo", "Dina", "Eli"]) await addWalkIn(page, name);
  await openTab(page, "Courts");
  await court(page, "Court 1").getByRole("button", { name: "Call next 4" }).click();
  await expect(onCourt(page, "Court 1")).toHaveText(["Ana", "Ben", "Carlo", "Dina"]);

  // Ana + Ben win; only Eli is waiting.
  await finishGame(page, "Court 1", ["Ana", "Ben"]);
  await expect(banner(page)).toHaveText(/Won: Ana and Ben\. Called: Eli, Carlo, Dina, Ana/);
  await expect(onCourt(page, "Court 1")).toHaveText(["Eli", "Carlo", "Dina", "Ana"]);
  await openTab(page, "Queue");
  await expect(queueRows(page)).toHaveText([/Ben/]);

  // Next game: Dina + Ana (the right side) win, Ben (who sat out) plays, and a winner sits out again.
  await openTab(page, "Courts");
  await finishGame(page, "Court 1", ["Dina", "Ana"]);
  await expect(onCourt(page, "Court 1")).toContainText(["Ben"]);
  await openTab(page, "Queue");
  await expect(queueRows(page)).toHaveCount(1);
  await expect(queueRows(page)).toHaveText([/Ana|Dina/]);
});
