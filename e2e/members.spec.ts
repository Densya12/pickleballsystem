import { expect, test } from "@playwright/test";
import { addMember, addMemberWalkIn, addWalkIn, openPlayer, queueRows, startSession } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

// Phase 7: Members, "From members" on walk-ins, and "Save as member".

test("members: add, search, edit; a walk-in from members; save a player as a member (or link)", async ({ page }) => {
  test.setTimeout(90_000);
  await signInWithNewClub(page, "members", "Member Club");

  await page.getByRole("navigation", { name: "Main menu" }).getByRole("link", { name: "Members" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Members" })).toBeVisible();
  await expect(page.getByText("No members yet.", { exact: false })).toBeVisible();

  await addMember(page, "Ana Reyes", { level: "Advanced", dues: "Dues paid", notes: "Fridays" });
  await addMember(page, "Niño Santos", { level: "Beginner" });
  await addMember(page, "Ben Cruz");
  const list = page.getByRole("list", { name: "Members" }).getByRole("listitem");
  await expect(list).toHaveText([
    "Ana ReyesAdvanced · Dues paid",
    "Ben CruzNot sure · No dues",
    "Niño SantosBeginner · No dues",
  ]);

  // Search ignores accents; tap to edit.
  await page.getByLabel("Search").fill("nino");
  await expect(list).toHaveText(["Niño SantosBeginner · No dues"]);
  await page.getByLabel("Search").fill("zzz");
  await expect(page.getByText('No member named "zzz".', { exact: false })).toBeVisible();
  await page.getByLabel("Search").fill("");
  await page.getByRole("link", { name: /Ben Cruz/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Edit member" })).toBeVisible();
  await page.getByRole("radio", { name: "Dues unpaid", exact: true }).check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(list.filter({ hasText: "Ben Cruz" })).toHaveText("Ben CruzNot sure · Dues unpaid");

  // A session: Niño from members (one tap + payment), and two plain walk-ins.
  await page.goto("/");
  await startSession(page, "Member Night", { courts: 1 });
  await addMemberWalkIn(page, "Niño Santos");
  await expect(queueRows(page).getByRole("button", { name: /Niño Santos/ })).toContainText("Beginner");
  await addWalkIn(page, "Ana Reyes", "Intermediate");
  await addWalkIn(page, "Carlo Diaz", "Advanced");

  // Niño is already a member.
  let sheet = await openPlayer(page, "Niño Santos");
  await expect(sheet.getByText("Member", { exact: true })).toBeVisible();
  await sheet.getByRole("button", { name: "Close" }).click();

  // Ana Reyes: same name as a member, so linking is offered instead of a duplicate.
  sheet = await openPlayer(page, "Ana Reyes");
  await sheet.getByRole("button", { name: "Save as member" }).click();
  await expect(sheet.getByText("Ana Reyes is already a member. Link Ana Reyes to them?")).toBeVisible();
  await sheet.getByRole("button", { name: "Link to them" }).click();
  await expect(sheet.getByText("Member", { exact: true })).toBeVisible();
  await sheet.getByRole("button", { name: "Close" }).click();

  // Carlo: a new member.
  sheet = await openPlayer(page, "Carlo Diaz");
  await sheet.getByRole("button", { name: "Save as member" }).click();
  await expect(sheet.getByText("Member", { exact: true })).toBeVisible();
  await sheet.getByRole("button", { name: "Close" }).click();

  await page.goto("/members");
  await expect(list).toHaveText([
    "Ana ReyesAdvanced · Dues paid",
    "Ben CruzNot sure · Dues unpaid",
    "Carlo DiazAdvanced · No dues",
    "Niño SantosBeginner · No dues",
  ]);
});
