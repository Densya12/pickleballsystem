import { expect, test } from "@playwright/test";
import { addWalkIn, banner, court, onCourt, queue, startSession } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

test("singles: a doubles court and a singles court in winners stay", async ({ page: organizer, browser }) => {
  test.setTimeout(90_000);
  await signInWithNewClub(organizer, "singles", "Makati Picklers");

  // Bagong open play: Court 2 is singles.
  await organizer.getByRole("link", { name: "Bagong open play" }).click();
  await expect(organizer.getByRole("group", { name: "Court 1" }).getByRole("radio", { name: "Doubles" })).toBeChecked();
  await expect(organizer.getByRole("group", { name: "Court 2" }).getByRole("radio", { name: "Doubles" })).toBeChecked();
  await organizer.getByRole("link", { name: "Bumalik" }).click();
  await startSession(organizer, "Mixed Night", { courts: 2, winnersStay: true, formats: ["Doubles", "Singles"] });

  await expect(court(organizer, "Court 1").getByText("Doubles", { exact: true })).toBeVisible();
  await expect(court(organizer, "Court 2").getByText("Singles", { exact: true })).toBeVisible();
  await expect(court(organizer, "Court 1").getByText("Kailangan pa ng 4 player")).toBeVisible();
  await expect(court(organizer, "Court 2").getByText("Kailangan pa ng 2 player")).toBeVisible();

  // Switch an empty court's format (with a confirm step), and back.
  await court(organizer, "Court 1").getByRole("button", { name: "Gawing Singles" }).click();
  await expect(court(organizer, "Court 1").getByText("Gawing Singles ang Court 1?")).toBeVisible();
  await court(organizer, "Court 1").getByRole("button", { name: "Oo, gawing Singles" }).click();
  await expect(banner(organizer)).toHaveText(/Singles na ang Court 1\./);
  await expect(court(organizer, "Court 1").getByText("Kailangan pa ng 2 player")).toBeVisible();
  await court(organizer, "Court 1").getByRole("button", { name: "Gawing Doubles" }).click();
  await court(organizer, "Court 1").getByRole("button", { name: "Oo, gawing Doubles" }).click();
  await expect(banner(organizer)).toHaveText(/Doubles na ang Court 1\./);
  await expect(court(organizer, "Court 1").getByText("Doubles", { exact: true })).toBeVisible();

  // Four walk-ins, then a phone player, then one more walk-in.
  for (const name of ["Ana", "Ben", "Carlo", "Dina"]) await addWalkIn(organizer, name);
  await organizer.getByRole("link", { name: "Ipakita ang QR" }).click();
  const path = new URL((await organizer.getByText(/\/j\/[A-Z2-9]{6}$/).textContent())!).pathname;
  await organizer.getByRole("link", { name: "Bumalik" }).click();

  const player = await (await browser.newContext()).newPage();
  await player.goto(path);
  await player.getByLabel("Pangalan mo").fill("Phone Pia");
  await player.getByRole("switch", { name: "Cash ang ibabayad ko" }).check();
  await player.getByRole("button", { name: "Pumila na" }).click();
  await expect(player.getByTestId("position")).toHaveText("#5");
  await expect(player.locator('[data-live-sync="connected"]')).toBeVisible();
  await addWalkIn(organizer, "Eli");

  // Call both: 4 on doubles, 2 on singles.
  await court(organizer, "Court 1").getByRole("button", { name: "Tawagin ang susunod" }).click();
  await expect(onCourt(organizer, "Court 1")).toHaveText(["Ana", "Ben", "Carlo", "Dina"]);
  await court(organizer, "Court 2").getByRole("button", { name: "Tawagin ang susunod" }).click();
  await expect(banner(organizer)).toHaveText(/Tinawag sa Court 2: Phone Pia, Eli/);
  await expect(onCourt(organizer, "Court 2")).toHaveText(["Phone Pia", "Eli"]);
  await expect(court(organizer, "Court 2").getByRole("button", { name: /Gawing/ })).toHaveCount(0);

  // The phone player sees their singles opponent.
  await expect(player.getByText("Ikaw na, Phone Pia!")).toBeVisible({ timeout: 2_000 });
  await expect(player.getByText("Pumunta ka na sa Court 2")).toBeVisible();
  await expect(player.getByText("Kalaban mo: Eli")).toBeVisible();
  await expect(player.getByText("Kasama mo sa court:")).toHaveCount(0);

  // Finish the singles game in winners stay: pick 1 winner; the winner stays, the next waiting joins.
  await addWalkIn(organizer, "Fe");
  await court(organizer, "Court 2").getByRole("button", { name: "Tapos na · tawagin ang susunod" }).click();
  const picker = court(organizer, "Court 2").getByRole("group", { name: "Sino ang nanalo?" });
  await expect(picker.getByText("Pumili ng 1 pa.")).toBeVisible();
  await expect(picker.getByRole("button", { name: "Kumpirmahin" })).toBeDisabled();
  await picker.getByRole("button", { name: "Phone Pia" }).click();
  await picker.getByRole("button", { name: "Kumpirmahin" }).click();
  await expect(banner(organizer)).toHaveText(/Tapos ang Laro #2 sa Court 2\. Panalo: Phone Pia\. Tinawag: Phone Pia, Fe/);
  await expect(onCourt(organizer, "Court 2")).toHaveText(["Phone Pia", "Fe"]);
  await expect(queue(organizer).getByRole("listitem")).toHaveText([/Eli/]);
  await expect(player.getByText("Kalaban mo: Fe")).toBeVisible({ timeout: 2_000 });

  await player.context().close();
});
