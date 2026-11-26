import { expect, test } from "@playwright/test";
import { addWalkIn, banner, court, onCourt, openTab, queueRows, startSession } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

test("singles: a doubles court and a singles court in winners stay", async ({ page: organizer, browser }) => {
  test.setTimeout(90_000);
  await signInWithNewClub(organizer, "singles", "Makati Picklers");

  // New session: both courts start as doubles; Court 2 is set to singles.
  await organizer.getByRole("link", { name: "New session" }).click();
  await expect(organizer.getByRole("group", { name: "Court 1" }).getByRole("radio", { name: "Doubles" })).toBeChecked();
  await expect(organizer.getByRole("group", { name: "Court 2" }).getByRole("radio", { name: "Doubles" })).toBeChecked();
  await organizer.getByRole("link", { name: "Home" }).click();
  await startSession(organizer, "Mixed Night", { courts: 2, winnersStay: true, formats: ["Doubles", "Singles"] });

  await expect(court(organizer, "Court 1").getByText("Doubles · Empty")).toBeVisible();
  await expect(court(organizer, "Court 2").getByText("Singles · Empty")).toBeVisible();
  await expect(court(organizer, "Court 1").getByRole("button", { name: "Need 4 more" })).toBeVisible();
  await expect(court(organizer, "Court 2").getByRole("button", { name: "Need 2 more" })).toBeVisible();

  // "Need N more" stays tappable and explains.
  await court(organizer, "Court 2").getByRole("button", { name: "Need 2 more" }).click();
  await expect(organizer.getByRole("alert").filter({ hasText: "Need 2 more players to call this court." })).toBeVisible();

  // Switch an empty court's format (with a confirm step), and back.
  await court(organizer, "Court 1").getByRole("button", { name: "Make singles" }).click();
  await expect(court(organizer, "Court 1").getByText("Make Court 1 singles?")).toBeVisible();
  await court(organizer, "Court 1").getByRole("button", { name: "Yes, singles" }).click();
  await expect(banner(organizer)).toHaveText(/Court 1 is now singles\./);
  await expect(court(organizer, "Court 1").getByRole("button", { name: "Need 2 more" })).toBeVisible();
  await court(organizer, "Court 1").getByRole("button", { name: "Make doubles" }).click();
  await court(organizer, "Court 1").getByRole("button", { name: "Yes, doubles" }).click();
  await expect(banner(organizer)).toHaveText(/Court 1 is now doubles\./);
  await expect(court(organizer, "Court 1").getByText("Doubles · Empty")).toBeVisible();

  // Four walk-ins, then a phone player, then one more walk-in.
  for (const name of ["Ana", "Ben", "Carlo", "Dina"]) await addWalkIn(organizer, name);
  await organizer.getByRole("link", { name: "Show QR" }).click();
  const path = new URL((await organizer.getByText(/\/j\/[A-Z2-9]{6}(?:[A-Z2-9]{2})?$/).textContent())!).pathname;
  await organizer.getByRole("link", { name: "Courts" }).click();

  const player = await (await browser.newContext()).newPage();
  await player.goto(path);
  await player.getByLabel("Name", { exact: true }).fill("Pia Cruz");
  await player.getByRole("button", { name: "Join queue" }).click();
  await expect(player.getByTestId("position")).toHaveText("5");
  await expect(player.locator('[data-live-sync="connected"]')).toBeVisible();
  await addWalkIn(organizer, "Eli");

  // Call both: 4 chips on doubles, 2 on singles.
  await openTab(organizer, "Courts");
  await court(organizer, "Court 1").getByRole("button", { name: "Call next 4" }).click();
  await expect(onCourt(organizer, "Court 1")).toHaveText(["Ana", "Ben", "Carlo", "Dina"]);
  await expect(court(organizer, "Court 1").locator("[data-chip]")).toHaveText(["Ana", "Ben", "Carlo", "Dina"]);
  await court(organizer, "Court 2").getByRole("button", { name: "Call next 2" }).click();
  await expect(banner(organizer)).toHaveText(/Called to Court 2: Pia Cruz, Eli/);
  await expect(onCourt(organizer, "Court 2")).toHaveText(["Pia Cruz", "Eli"]);
  await expect(court(organizer, "Court 2").locator("[data-chip]")).toHaveText(["Pia", "Eli"]);
  await expect(court(organizer, "Court 2").getByRole("button", { name: /^Make/ })).toHaveCount(0);

  // The phone player sees the singles court: their chip and their opponent's.
  await expect(player.getByRole("heading", { name: "Your turn, Pia!" })).toBeVisible({ timeout: 2_000 });
  await expect(player.getByRole("alert").filter({ hasText: "You're up" })).toContainText("Court 2");
  await expect(player.getByText("Singles · you're highlighted")).toBeVisible();
  await expect(player.locator("[data-chip]")).toHaveText(["Pia", "Eli"]);

  // Finish the singles game in winners stay with only Fe waiting (fewer than 2): D23 (QA-03)
  // sends everyone off LOSER FIRST, so Fe and the loser (Eli) play next and the winner sits out.
  await addWalkIn(organizer, "Fe");
  await openTab(organizer, "Courts");
  await organizer.getByRole("button", { name: "Done on Court 2" }).click();
  const picker = court(organizer, "Court 2").getByRole("group", { name: "Who won?" });
  await expect(picker.getByText("Tap the side that won.")).toBeVisible();
  await picker.getByRole("button", { name: /Pia won$/ }).click();
  await expect(banner(organizer)).toHaveText(/Game #2 on Court 2 is done\. Won: Pia Cruz\. Called: Fe, Eli/);
  await expect(onCourt(organizer, "Court 2")).toHaveText(["Fe", "Eli"]);
  // Pia sits out this one, first in line.
  await expect(player.getByTestId("position")).toHaveText("1", { timeout: 2_000 });
  await openTab(organizer, "Queue");
  await expect(queueRows(organizer)).toHaveText([/Pia Cruz/]);

  await player.context().close();
});
