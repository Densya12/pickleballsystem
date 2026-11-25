import { expect, test } from "@playwright/test";
import { addWalkIn, banner, court, openMore, openTab, startSession } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

// Pre-pilot: Done on a court whose only players are called again, and changing
// All off / Winners stay while the session is live (More › After a game).

test("singles with 2 players: Done calls them again (Game 2, banner); then Winners stay from More", async ({ page }) => {
  test.setTimeout(90_000);
  await signInWithNewClub(page, "rotation", "Rotation Club");
  await startSession(page, "Pair Night", { courts: 1, formats: ["Singles"] });
  const liveLine = page.getByText(/^Live · /).filter({ visible: true });
  await expect(liveLine).toHaveText("Live · All off · 0 playing · 0 in queue");

  for (const name of ["Ana", "Ben"]) await addWalkIn(page, name);
  await openTab(page, "Courts");
  await court(page, "Court 1").getByRole("button", { name: "Call next 2" }).click();
  await expect(court(page, "Court 1").getByText(/^Game 1 · \d+ min$/)).toBeVisible();

  // All off with nobody else waiting: the same two are called again, and the screen says so.
  await page.getByRole("button", { name: "Done on Court 1" }).click();
  await expect(banner(page)).toHaveText(
    /Nobody else is waiting, so (Ana and Ben|Ben and Ana) play again on Court 1\./,
  );
  await expect(court(page, "Court 1").getByText(/^Game 2 · \d+ min$/)).toBeVisible();
  // The court card is briefly highlighted for the new game.
  await expect(court(page, "Court 1")).toHaveAttribute("data-new-game", "true");
  await expect(liveLine).toHaveText("Live · All off · 2 playing · 0 in queue");

  // More › After a game: switch to Winners stay while live.
  const more = await openMore(page);
  const afterGame = more.getByRole("group", { name: "After a game" });
  await expect(afterGame).toHaveAccessibleDescription("Takes effect at the next Done.");
  await expect(afterGame.getByRole("radio", { name: /^All off/ })).toBeChecked();
  await afterGame.getByRole("radio", { name: /^Winners stay/ }).check();
  await expect(banner(page)).toHaveText(
    /After a game: Winners stay\. It applies from the next Done\./,
  );
  await expect(afterGame.getByRole("radio", { name: /^Winners stay/ })).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(more).toBeHidden();
  await expect(liveLine).toHaveText("Live · Winners stay · 2 playing · 0 in queue");

  // The next Done asks who won: 1 winner on singles.
  await page.getByRole("button", { name: "Done on Court 1" }).click();
  const picker = court(page, "Court 1").getByRole("group", { name: "Who won?" });
  await expect(picker).toHaveAccessibleDescription("Pick 1 more.");
  await picker.getByRole("button", { name: "Ana" }).click();
  await picker.getByRole("button", { name: "Confirm" }).click();
  await expect(court(page, "Court 1").getByText(/^Game 3 · \d+ min$/)).toBeVisible();

  // The setting is kept after a reload.
  await page.reload();
  await expect(liveLine).toHaveText("Live · Winners stay · 2 playing · 0 in queue");
});
