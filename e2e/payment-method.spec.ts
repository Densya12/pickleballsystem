import { expect, test, type Page } from "@playwright/test";
import { openTab, SESSION_URL, startSession } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

// Brand-neutral payments: Settings › Club details › Payment (method, account,
// cash accepted), and a player paying with Maya. A club on another method must
// never see "GCash". Screenshots at 390x844 go to docs/qa/img/pay-*.png.

const SIZE = { width: 390, height: 844 };
const shot = (page: Page, name: string) => page.screenshot({ path: `docs/qa/img/pay-${name}.png`, fullPage: true });

/** Fails if "GCash" is on screen (visible text only: hidden radio values and scripts don't count). */
async function noGcash(page: Page) {
  await expect(page.locator("body")).not.toContainText("GCash", { useInnerText: true });
}

test("Settings › Club details › Payment: method, Other name, account, cash accepted; the old page redirects", async ({ page }) => {
  await page.setViewportSize(SIZE);
  await signInWithNewClub(page, "pay-settings", "Maya Club");
  await page.getByRole("navigation", { name: "Main menu" }).getByRole("link", { name: "Settings" }).click();
  // One place for payment now: no separate "GCash and fee" row.
  await expect(page.getByRole("link", { name: /GCash/ })).toHaveCount(0);
  await page.getByRole("link", { name: /Club details/ }).click();

  const payment = page.getByRole("heading", { level: 2, name: "Payment" });
  await expect(payment).toBeVisible();
  await expect(page.getByLabel("Default fee per player (₱)")).toHaveValue("150");
  const method = page.getByRole("group", { name: "Payment method" });
  for (const name of ["GCash", "Maya", "Bank transfer", "Other"]) await expect(method.getByRole("radio", { name })).toBeVisible();
  await expect(method.getByRole("radio", { name: "GCash" })).toBeChecked();
  const cash = page.getByRole("group", { name: "Cash accepted" });
  await expect(cash.getByRole("radio", { name: "On" })).toBeChecked();

  // Other asks for its name (2-30 characters).
  await method.getByRole("radio", { name: "Other" }).check();
  await expect(page.getByLabel("Name of the method")).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Enter the method's name, 2 to 30 characters.")).toBeVisible();

  // Maya: the Other name goes away; a mobile number; no cash.
  await method.getByRole("radio", { name: "Maya" }).check();
  await expect(page.getByLabel("Name of the method")).toHaveCount(0);
  await page.getByLabel("Account name").fill("Juan Dela Cruz");
  await page.getByLabel("Account number").fill("0917 123 4567");
  await cash.getByRole("radio", { name: "Off" }).check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await expect(method.getByRole("radio", { name: "Maya" })).toBeChecked();
  await expect(cash.getByRole("radio", { name: "Off" })).toBeChecked();
  await expect(page.getByLabel("Account number")).toHaveValue("09171234567");
  await payment.scrollIntoViewIfNeeded();
  await shot(page, "settings-payment");

  // Bank transfer takes a bank account number.
  await method.getByRole("radio", { name: "Bank transfer" }).check();
  await page.getByLabel("Account number").fill("0012-3456-7890");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // The old "GCash and fee" link lands on Club details.
  await page.goto("/settings/payments");
  await expect(page).toHaveURL(/\/settings\/club(#payment)?$/);
  await expect(page.getByRole("heading", { level: 2, name: "Payment" })).toBeVisible();
});

test("a player pays with Maya; no cash choices; nothing says GCash anywhere", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await page.setViewportSize(SIZE);
  await signInWithNewClub(page, "pay-maya", "Maya Club");
  await page.getByRole("navigation", { name: "Main menu" }).getByRole("link", { name: "Settings" }).click();
  await page.getByRole("link", { name: /Club details/ }).click();
  await page.getByRole("group", { name: "Payment method" }).getByRole("radio", { name: "Maya" }).check();
  await page.getByLabel("Account name").fill("Juan Dela Cruz");
  await page.getByLabel("Account number").fill("0917 123 4567");
  await page.getByRole("group", { name: "Cash accepted" }).getByRole("radio", { name: "Off" }).check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.goto("/");

  // New session: the same payment details, from Settings.
  await page.getByRole("link", { name: "New session" }).click();
  await expect(page.getByTestId("session-payment")).toContainText("Maya · Juan Dela Cruz · 0917 123 4567");
  await expect(page.getByTestId("session-payment")).toContainText("No cash");
  await noGcash(page);
  await page.goBack();
  await startSession(page, "Maya Night", { courts: 1 });
  await noGcash(page);

  // Walk-in: Maya or Pay later; no cash choice.
  await page.getByRole("link", { name: "Walk-in" }).click();
  const choices = page.getByRole("group", { name: "Payment · ₱150" });
  await expect(choices.getByRole("radio", { name: "Maya", exact: true })).toBeVisible();
  await expect(choices.getByRole("radio", { name: "Pay later", exact: true })).toBeVisible();
  await expect(choices.getByRole("radio", { name: "Paid cash" })).toHaveCount(0);
  await noGcash(page);
  await page.getByRole("link", { name: /^Queue/ }).first().click();
  await expect(page).toHaveURL(/\/queue$/);

  // The player: My place › Add reference number shows the club's Maya.
  await page.getByRole("link", { name: "Show QR" }).click();
  const path = new URL((await page.getByText(/\/j\/[A-Z2-9]{6}(?:[A-Z2-9]{2})?$/).textContent())!).pathname;
  await page.goBack();
  const player = await (await browser.newContext({ viewport: SIZE })).newPage();
  await player.goto(path);
  await player.getByLabel("Name", { exact: true }).fill("Ana Phone");
  await player.getByRole("button", { name: "Join queue" }).click();
  await expect(player.locator("[data-payment]")).toContainText("Payment · ₱150");
  await player.getByRole("button", { name: "Add reference number" }).click();
  await expect(player.getByTestId("pay-to")).toContainText("Maya · Send to · Juan Dela Cruz");
  await expect(player.getByTestId("pay-to")).toContainText("0917 123 4567");
  await player.getByLabel("Reference number").fill("1234 5678 90");
  await noGcash(player);
  await shot(player, "player-payment");
  await player.getByRole("button", { name: "Send reference" }).click();
  await expect(player.locator("[data-payment]")).toContainText("Maya · waiting for the organizer");
  await noGcash(player);

  // Payments: to check in Maya; Received; the paid list says Maya.
  await page.goto(page.url().replace(/\/queue$/, ""));
  await expect(page).toHaveURL(SESSION_URL);
  await openTab(page, "Payments");
  const check = page.getByRole("region", { name: "To check" });
  await expect(page.getByText("Find the reference number in your Maya before tapping Received.")).toBeVisible();
  await noGcash(page);
  await check.getByRole("button", { name: "Received from Ana Phone" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Ana Phone's payment (Maya) is confirmed." })).toBeVisible();
  await page.locator("summary").filter({ hasText: "Paid" }).click();
  await expect(page.getByText("Maya · •••• 7890")).toBeVisible();
  await noGcash(page);
  await expect(player.locator("[data-payment]")).toContainText("Paid", { timeout: 5_000 });

  // The guide, Terms and Privacy are brand-neutral too.
  for (const url of ["/guide", "/terms", "/privacy"]) {
    await page.goto(url);
    await noGcash(page);
  }
  await player.context().close();
});
