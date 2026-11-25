import { expect, test } from "@playwright/test";
import { addWalkIn, banner, queueRows, startSession } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

// QA-05: one phone can't flood a queue. Duplicate names are refused at
// check-in, the organizer is warned (and can override) on walk-ins, and new
// phone check-ins are marked "New" on the Queue tab. (The 200-player cap is
// covered by pgTAP 19_qa05_checkin_limits.)

test("duplicate names at check-in, the walk-in warning, and 'New' on the Queue tab", async ({ page, browser }) => {
  test.setTimeout(90_000);
  await signInWithNewClub(page, "checkin-limits", "Limits Club");
  await startSession(page, "Limits Night", { courts: 1 });
  await addWalkIn(page, "Walk Bea");
  await page.getByRole("link", { name: "Show QR" }).click();
  const path = new URL((await page.getByText(/\/j\/[A-Z2-9]{6}(?:[A-Z2-9]{2})?$/).textContent())!).pathname;
  const queueUrl = page.url().replace(/\/qr$/, "/queue");

  const join = async (name: string) => {
    const phone = await (await browser.newContext()).newPage();
    await phone.setViewportSize({ width: 360, height: 640 });
    await phone.goto(path);
    await phone.getByLabel("Name", { exact: true }).fill(name);
    await phone.getByRole("radio", { name: "Cash", exact: true }).check();
    await phone.getByRole("button", { name: "Join queue" }).click();
    return phone;
  };

  const first = await join("Mark Santos");
  await expect(first.getByTestId("position")).toBeVisible();

  // A second phone, same name with other case and spaces: refused, on the name field, in view.
  const second = await join("  mark   SANTOS ");
  const nameField = second.getByLabel("Name", { exact: true });
  await expect(nameField).toHaveAccessibleDescription("That name is already in line. Add your last initial, e.g. Mark D.");
  await expect(nameField).toBeFocused();
  await expect(second).not.toHaveURL(/\/me$/);
  await second.screenshot({ path: "docs/qa/img/fix-qa-05-name-taken.png" });
  // With a last initial it works.
  await nameField.fill("Mark D.");
  await second.getByRole("button", { name: "Join queue" }).click();
  await expect(second.getByTestId("position")).toBeVisible();

  // Organizer: phone check-ins are "New"; the walk-in isn't.
  await page.goto(queueUrl);
  await expect(queueRows(page).filter({ hasText: "Mark Santos" })).toContainText("New");
  await expect(queueRows(page).filter({ hasText: "Mark D." })).toContainText("New");
  await expect(queueRows(page).filter({ hasText: "Walk Bea" })).not.toContainText("New");
  await page.screenshot({ path: "docs/qa/img/fix-qa-05-new-on-queue.png" });

  // Walk-in with a name already in line: a warning, then "Add anyway".
  await page.getByRole("link", { name: "Walk-in" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Mark Santos");
  await page.getByRole("radio", { name: "Pay later", exact: true }).check();
  await page.getByRole("button", { name: "Add to queue" }).click();
  await expect(page.getByText("Mark Santos is already in line. Add a last initial, or tap Add anyway.")).toBeVisible();
  await page.getByRole("button", { name: "Add anyway" }).click();
  await expect(banner(page)).toContainText("Mark Santos is in the queue");
  await expect(queueRows(page).filter({ hasText: "Mark Santos" })).toHaveCount(2);

  await first.context().close();
  await second.context().close();
});
