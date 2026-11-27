import { expect, test, type Browser, type Page } from "@playwright/test";
import { addWalkIn, banner, court, onCourt, openTab, queueSection, sessionTabs, SESSION_URL, finishGame } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

// "Remind" falls back to copying when there is no share sheet; read the clipboard.
test.use({ permissions: ["clipboard-read", "clipboard-write"] });

async function phone(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  return page;
}

/**
 * QA-06: the check-in page (open to anyone with the code) shows no payment
 * details. After joining, My place shows the fee, the hold and the club's
 * GCash, and takes the reference.
 */
async function checkIn(player: Page, path: string, name: string, pay: { reference?: string } = {}) {
  await player.goto(path);
  await expect(player.getByRole("button", { name: "Join queue" })).toBeVisible();
  await expect(player.getByRole("heading", { name: "Payment" })).toHaveCount(0);
  await expect(player.getByText(/Juan Dela Cruz|0917 123 4567/)).toHaveCount(0);
  await player.getByLabel("Name", { exact: true }).fill(name);
  await player.getByRole("button", { name: "Join queue" }).click();
  await expect(player.getByRole("heading", { level: 1, name: `Hi, ${name.split(" ")[0]}` })).toBeVisible();
  await expect(player.locator('[data-live-sync="connected"]')).toBeVisible();
  await expect(player.locator("[data-payment]")).toContainText("Payment · ₱150");
  await expect(player.getByText("You'll be skipped until you pay.")).toBeVisible();
  if (pay.reference) {
    await player.getByRole("button", { name: "Add GCash reference" }).click();
    await expect(player.getByText(/Juan Dela Cruz/)).toBeVisible();
    await expect(player.getByText("0917 123 4567")).toBeVisible();
    await player.getByLabel("GCash reference no.").fill(pay.reference);
    await player.getByRole("button", { name: "Send reference" }).click();
  }
}

function paymentLine(player: Page) {
  return player.locator("[data-payment]");
}

function status(page: Page, text: string) {
  return page.getByRole("status").filter({ hasText: text });
}

test("pay first: GCash (to check) gets called, cash is held until received on Payments", async ({ page: organizer, browser }) => {
  test.setTimeout(120_000);
  await organizer.addInitScript(() => Object.defineProperty(navigator, "share", { configurable: true, value: undefined }));
  await signInWithNewClub(organizer, "payments", "Makati Picklers");

  // The club's GCash (Settings › GCash and fee), shown to players at check-in.
  await organizer.getByRole("navigation", { name: "Main menu" }).getByRole("link", { name: "Settings" }).click();
  await organizer.getByRole("link", { name: /GCash and fee/ }).click();
  await organizer.getByLabel("Name on GCash").fill("Juan Dela Cruz");
  await organizer.getByLabel("GCash number").fill("0917 123 4567");
  await organizer.getByRole("button", { name: "Save" }).click();
  await expect(organizer.getByText("Saved.")).toBeVisible();
  await organizer.goto("/");

  // Pay-first session, ₱150 (club default), 1 court, all off.
  await organizer.getByRole("link", { name: "New session" }).click();
  await organizer.getByLabel("Session name").fill("Pay First Night");
  await organizer.getByRole("button", { name: "Fewer courts" }).click();
  await organizer.getByRole("switch", { name: "Pay before queueing" }).check();
  // D25: the queue order these checks expect (Fair line).
  await organizer.getByRole("radio", { name: /^Fair line/ }).check();
  await organizer.getByRole("button", { name: "Start session" }).click();
  await expect(organizer).toHaveURL(SESSION_URL);
  const courtsUrl = organizer.url();

  // Walk-ins with each payment choice (one GCash walk-in reuses Ana's reference).
  await addWalkIn(organizer, "Cash Walk", "Level 2", { choice: "Paid cash" });
  await addWalkIn(organizer, "GCash Walk", "Level 2", { choice: "GCash", reference: "1234-5678-90" });
  await addWalkIn(organizer, "Later Walk", "Level 2", { choice: "Pay later" });
  await addWalkIn(organizer, "Cash Two", "Level 2", { choice: "Paid cash" });

  await organizer.getByRole("link", { name: "Show QR" }).click();
  const path = new URL((await organizer.getByText(/\/j\/[A-Z2-9]{6}(?:[A-Z2-9]{2})?$/).textContent())!).pathname;
  await organizer.goto(`${courtsUrl}/queue`);

  // Ana pays by GCash (to check); Ben will pay cash (held).
  const ana = await phone(browser);
  await checkIn(ana, path, "Ana Phone", { reference: "1234 5678 90" });
  await expect(paymentLine(ana)).toHaveText(/GCash · waiting for the organizer/);
  const ben = await phone(browser);
  await checkIn(ben, path, "Ben Phone");
  await expect(paymentLine(ben)).toHaveText(/Not paid yet/);
  await expect(ben.getByText("You'll be skipped until you pay.")).toBeVisible();

  // Queue: unpaid players are On hold with "Unpaid"; Ana (to check) is not.
  const onHold = queueSection(organizer, "On hold");
  await expect(onHold.getByRole("button", { name: /Later Walk/ })).toContainText("Unpaid");
  await expect(onHold.getByRole("button", { name: /Ben Phone/ })).toContainText("Unpaid", { timeout: 2_000 });
  await expect(onHold.getByRole("button", { name: /Ana Phone/ })).toHaveCount(0);

  // BR6/BR14: the call skips the unpaid (Later Walk, Ben) and takes Ana (to check).
  await openTab(organizer, "Courts");
  await court(organizer, "Court 1").getByRole("button", { name: "Call next 4" }).click();
  await expect(onCourt(organizer, "Court 1")).toHaveText(["Cash Walk", "GCash Walk", "Cash Two", "Ana Phone"]);
  await expect(ana.getByRole("heading", { name: "Your turn, Ana!" })).toBeVisible({ timeout: 2_000 });
  // "On my way" goes back to My place, with the payment row.
  await ana.getByRole("button", { name: "On my way" }).click();

  // Payments tab: the badge counts what needs action (2 to check + 2 unpaid).
  await expect(sessionTabs(organizer).getByRole("link", { name: "Payments, 4 to act on" })).toBeVisible();
  await openTab(organizer, "Payments");
  await expect(organizer.getByRole("heading", { level: 1, name: "Payments" })).toBeVisible();
  await expect(organizer.getByText("₱300", { exact: true })).toBeVisible();
  await expect(organizer.getByText("of ₱900")).toBeVisible();
  await expect(organizer.getByTestId("payment-counts")).toHaveText("2 paid · 2 to check · 2 unpaid · ₱150 each");

  const check = organizer.getByRole("region", { name: "Check in your GCash" });
  await expect(organizer.getByText("Find the reference in your GCash before tapping Received.")).toBeVisible();
  // BR15: the duplicate is flagged on both, not rejected.
  await expect(check.getByText("Same ref as Ana Phone")).toBeVisible();
  await expect(check.getByText("Same ref as GCash Walk")).toBeVisible();
  const anaRow = check.getByRole("group", { name: "Ana Phone" });
  await expect(anaRow.getByText("Ref •••• 7890")).toBeVisible();
  await anaRow.getByRole("button", { name: "Show Ana Phone's full reference" }).click();
  await expect(anaRow.getByText("Ref 1234567890")).toBeVisible();
  await anaRow.getByRole("button", { name: "Received from Ana Phone" }).click();
  await expect(status(organizer, "Ana Phone's GCash is confirmed.")).toBeVisible();
  await expect(paymentLine(ana)).toHaveText(/Paid/, { timeout: 2_000 });

  // Remind copies the reminder; then Ben's cash is received.
  const unpaid = organizer.getByRole("region", { name: "Unpaid", exact: true });
  const benRow = unpaid.getByRole("group", { name: "Ben Phone" });
  await expect(benRow.getByText("Must pay before being called")).toBeVisible();
  await benRow.getByRole("button", { name: "Remind Ben Phone" }).click();
  await expect(status(organizer, "Reminder for Ben Phone copied.")).toBeVisible();
  expect(await organizer.evaluate(() => navigator.clipboard.readText())).toBe(
    "Hi Ben Phone! A friendly reminder about your payment for Pay First Night: ₱150. GCash: Juan Dela Cruz 0917 123 4567. Thank you!",
  );
  await benRow.getByRole("button", { name: "Cash received from Ben Phone" }).click();
  await expect(status(organizer, "Got Ben Phone's cash.")).toBeVisible();
  await expect(paymentLine(ben)).toHaveText(/Paid/, { timeout: 2_000 });

  // D18: "Undo" reverses the last Received (cash still chosen), then it's received again.
  await organizer.getByRole("button", { name: /^Undo \(\d+s\)$/ }).click();
  await expect(status(organizer, "Ben Phone's payment is back to how it was.")).toBeVisible();
  await expect(paymentLine(ben)).toHaveText(/Not paid yet/, { timeout: 2_000 });
  await expect(benRow).toContainText("Must pay before being called");
  await benRow.getByRole("button", { name: "Cash received from Ben Phone" }).click();
  await expect(paymentLine(ben)).toHaveText(/Paid/, { timeout: 2_000 });
  await expect(organizer.getByTestId("payment-counts")).toHaveText("4 paid · 1 to check · 1 unpaid · ₱150 each");

  // Mark as unpaid (behind a confirm), from the collapsed Paid list.
  await organizer.getByText("Paid", { exact: true }).filter({ visible: true }).click();
  const paidRow = organizer.getByRole("group", { name: "Cash Two" });
  await paidRow.getByRole("button", { name: "Mark as unpaid" }).click();
  await paidRow.getByRole("button", { name: "Yes, mark unpaid" }).click();
  await expect(status(organizer, "Cash Two is marked unpaid again.")).toBeVisible();
  await expect(organizer.getByTestId("payment-counts")).toHaveText("3 paid · 1 to check · 2 unpaid · ₱150 each");

  // Back on Courts: the next call takes Ben (now paid) and still skips Later Walk.
  await openTab(organizer, "Courts");
  await finishGame(organizer, "Court 1");
  await expect(banner(organizer)).toHaveText(/Called: Ben Phone, Cash Walk, GCash Walk, Ana Phone/);
  await expect(ben.getByRole("heading", { name: "Your turn, Ben!" })).toBeVisible({ timeout: 2_000 });
  await openTab(organizer, "Queue");
  await expect(queueSection(organizer, "On hold").getByRole("button", { name: /Later Walk/ })).toContainText("Unpaid");

  await ana.context().close();
  await ben.context().close();
});

test("a free session has no payment step", async ({ page: organizer, browser }) => {
  await signInWithNewClub(organizer, "free", "Libre Club");
  await organizer.getByRole("link", { name: "New session" }).click();
  await organizer.getByLabel("Session name").fill("Free Night");
  await organizer.getByLabel("Fee per player (₱)").fill("0");
  // D25: the queue order these checks expect (Fair line).
  await organizer.getByRole("radio", { name: /^Fair line/ }).check();
  await organizer.getByRole("button", { name: "Start session" }).click();
  await expect(organizer).toHaveURL(SESSION_URL);
  // No Payments tab for a free session.
  await expect(sessionTabs(organizer).getByRole("link", { name: /^Payments/ })).toHaveCount(0);
  await organizer.getByRole("link", { name: "Walk-in" }).click();
  await expect(organizer.getByRole("heading", { level: 1, name: "Add walk-in" })).toBeVisible();
  await expect(organizer.getByRole("radio", { name: "Pay later" })).toHaveCount(0);
  await organizer.getByRole("link", { name: "Queue" }).click();
  await expect(organizer).toHaveURL(/\/queue$/);

  await organizer.getByRole("link", { name: "Show QR" }).click();
  const path = new URL((await organizer.getByText(/\/j\/[A-Z2-9]{6}(?:[A-Z2-9]{2})?$/).textContent())!).pathname;
  const player = await phone(browser);
  await player.goto(path);
  await expect(player.getByRole("button", { name: "Join queue" })).toBeVisible();
  await expect(player.getByRole("heading", { name: "Payment" })).toHaveCount(0);
  await expect(player.getByLabel("GCash reference no.")).toHaveCount(0);
  await player.getByLabel("Name", { exact: true }).fill("Fely Free");
  await player.getByRole("button", { name: "Join queue" }).click();
  await expect(player.getByRole("heading", { level: 1, name: "Hi, Fely" })).toBeVisible();
  await expect(paymentLine(player)).toHaveCount(0);
  await player.context().close();
});
