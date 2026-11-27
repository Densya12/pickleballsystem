import { expect, test } from "@playwright/test";
import { addWalkIn, court, onCourt, openPlayer, openTab, queueRows, startSession, finishGame } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

// QA-02 (NF10): a Remove saved offline on phone 1, while phone 2 calls that
// player onto a court, must not vanish: phone 1 is told and can discard it.

test("offline Remove of a player who was called meanwhile: 'Not sent' with the reason, then Discard", async ({ page, context, browser }) => {
  test.setTimeout(90_000);
  await signInWithNewClub(page, "outbox-conflict", "Outbox Conflict Club");
  await startSession(page, "Conflict Night", { courts: 1 });
  for (const n of ["O1", "O2", "O3", "O4", "O5", "O6", "O7", "O8"]) await addWalkIn(page, n);
  const queueUrl = page.url();
  await openTab(page, "Courts");
  const courtsUrl = page.url();
  await court(page, "Court 1").getByRole("button", { name: "Call next 4" }).click();
  await expect(onCourt(page, "Court 1")).toHaveText(["O1", "O2", "O3", "O4"]);
  await page.goto(queueUrl);
  await expect(queueRows(page)).toHaveCount(4);

  const other = await browser.newContext({ storageState: await context.storageState() });
  const phone2 = await other.newPage();
  await phone2.goto(courtsUrl);

  // Phone 1 loses signal and removes O5 (still shown waiting).
  await context.setOffline(true);
  const sheet = await openPlayer(page, "O5");
  await sheet.getByRole("button", { name: "Remove from queue" }).click();
  await sheet.getByRole("button", { name: "Yes, remove" }).click();
  await expect(page.getByRole("region", { name: "Waiting for signal" }).getByRole("listitem")).toHaveText(["Remove O5"]);

  // Phone 2 taps Done: O5-O8 are called.
  await finishGame(phone2, "Court 1");
  await expect(onCourt(phone2, "Court 1")).toHaveText(["O5", "O6", "O7", "O8"]);

  // Phone 1 is back: the Remove isn't dropped silently.
  await context.setOffline(false);
  const failed = page.getByRole("alert").filter({ hasText: "Not sent: Remove O5." });
  await expect(failed).toContainText("O5 is on court now.", { timeout: 20_000 });
  await page.screenshot({ path: "docs/qa/img/fix-qa-02-not-sent.png" });
  await page.getByRole("button", { name: "Discard this action" }).click();
  await expect(failed).toHaveCount(0);

  // O5 is still on court (the Remove was refused, not half-done).
  await phone2.reload();
  await expect(onCourt(phone2, "Court 1")).toHaveText(["O5", "O6", "O7", "O8"]);
  await other.close();
});
