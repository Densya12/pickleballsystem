import { expect, test } from "@playwright/test";
import { addMember, addMemberWalkIn, addWalkIn, queue, startSession } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

// Phase 7: Mga member, "Pumili sa members" on walk-ins, and "I-save bilang member".

test("members: add, search, edit; a walk-in from members; save a player as a member (or link)", async ({ page }) => {
  test.setTimeout(90_000);
  await signInWithNewClub(page, "members", "Member Club");

  await page.getByRole("link", { name: "Mga member" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Mga member" })).toBeVisible();
  await expect(page.getByText("Wala pang member.", { exact: false })).toBeVisible();

  await addMember(page, "Ana Reyes", { level: "Advanced", dues: "Bayad ang dues", notes: "Tuwing Biyernes" });
  await addMember(page, "Niño Santos", { level: "Beginner" });
  await addMember(page, "Ben Cruz");
  const list = page.getByRole("list", { name: "Mga member" }).getByRole("listitem");
  await expect(list).toHaveText([
    "Ana ReyesAdvanced · Bayad ang dues",
    "Ben CruzHindi sigurado · Walang dues",
    "Niño SantosBeginner · Walang dues",
  ]);

  // Search ignores accents; tap to edit.
  await page.getByLabel("Hanapin").fill("nino");
  await expect(list).toHaveText(["Niño SantosBeginner · Walang dues"]);
  await page.getByLabel("Hanapin").fill("zzz");
  await expect(page.getByText('Walang member na "zzz".', { exact: false })).toBeVisible();
  await page.getByLabel("Hanapin").fill("");
  await page.getByRole("link", { name: /Ben Cruz/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "I-edit ang member" })).toBeVisible();
  await page.getByRole("radio", { name: "Hindi pa bayad ang dues", exact: true }).check();
  await page.getByRole("button", { name: "I-save" }).click();
  await expect(list.filter({ hasText: "Ben Cruz" })).toHaveText("Ben CruzHindi sigurado · Hindi pa bayad ang dues");

  // A session: Niño from members (one tap + payment), and two plain walk-ins.
  await page.getByRole("link", { name: "Bumalik" }).click();
  await startSession(page, "Member Night", { courts: 1 });
  await addMemberWalkIn(page, "Niño Santos");
  await expect(queue(page).getByRole("button", { name: /Niño Santos/ })).toContainText("Beginner");
  await addWalkIn(page, "Ana Reyes", "Intermediate");
  await addWalkIn(page, "Carlo Diaz", "Advanced");

  // Niño is already a member.
  await queue(page).getByRole("button", { name: /Niño Santos/ }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Member na")).toBeVisible();
  await sheet.getByRole("button", { name: "Isara" }).click();

  // Ana Reyes: same name as a member, so linking is offered instead of a duplicate.
  await queue(page).getByRole("button", { name: /Ana Reyes/ }).click();
  await sheet.getByRole("button", { name: "I-save bilang member" }).click();
  await expect(sheet.getByText("May member na na Ana Reyes. I-link si Ana Reyes sa kanya?")).toBeVisible();
  await sheet.getByRole("button", { name: "I-link sa kanya" }).click();
  await expect(sheet.getByText("Member na")).toBeVisible();
  await sheet.getByRole("button", { name: "Isara" }).click();

  // Carlo: a new member.
  await queue(page).getByRole("button", { name: /Carlo Diaz/ }).click();
  await sheet.getByRole("button", { name: "I-save bilang member" }).click();
  await expect(sheet.getByText("Member na")).toBeVisible();
  await sheet.getByRole("button", { name: "Isara" }).click();

  await page.goto("/members");
  await expect(list).toHaveText([
    "Ana ReyesAdvanced · Bayad ang dues",
    "Ben CruzHindi sigurado · Hindi pa bayad ang dues",
    "Carlo DiazAdvanced · Walang dues",
    "Niño SantosBeginner · Walang dues",
  ]);
});
