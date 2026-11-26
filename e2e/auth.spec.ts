import { expect, test, type Locator, type Page } from "@playwright/test";
import { uniqueEmail } from "./support/organizer";

/** True when the element's centre is on screen and nothing else is drawn over it. */
async function fullyTappable(page: Page, locator: Locator): Promise<boolean> {
  const box = await locator.boundingBox();
  const size = page.viewportSize()!;
  if (!box || box.y < -1 || box.y + box.height > size.height + 1 || box.x < -1 || box.x + box.width > size.width + 1) return false;
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit !== null && (hit === el || el.contains(hit));
  });
}

test.describe("signed-out visitor", () => {
  test("visiting / redirects to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { level: 1, name: "Open play, one fair line." })).toBeVisible();
    await expect(page).toHaveTitle("Sign in · Pilaball");
  });

  test("private pages redirect to /login and remember where to return", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login\?next=%2Fsettings$/);
  });

  test("/login: the wordmark, one main button (Google), email one tap away, legal links", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("img", { name: "Pilaball" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sign in to run your club" })).toBeVisible();
    await expect(page.getByText("For organizers. Players just scan the QR at the court.")).toBeVisible();
    const google = page.getByRole("button", { name: "Continue with Google" });
    await expect(google).toBeVisible();
    // One main (52px) button; the other action is a 44px text button.
    expect((await google.boundingBox())!.height).toBeGreaterThanOrEqual(50);
    const useEmail = page.getByRole("button", { name: "Use email instead" });
    expect((await useEmail.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await useEmail.boundingBox())!.height).toBeLessThan(50);
    await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    await expect(page.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
  });

  test("the email flow reaches Check your email, and back keeps the address", async ({ page }) => {
    const email = uniqueEmail("signin-ui");
    await page.goto("/login");
    await page.getByRole("button", { name: "Use email instead" }).click();
    const field = page.getByLabel("Email", { exact: true });
    await expect(field).toBeFocused();
    await expect(field).toHaveAttribute("type", "email");
    await field.fill(email);
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Resend link in \d:\d\d$/ })).toBeDisabled();
    await page.getByRole("button", { name: "Use a different email" }).click();
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email);
  });

  for (const code of ["link", "auth"]) {
    test(`/login?error=${code} shows the amber alert, then Send a new email link opens email`, async ({ page }) => {
      await page.goto(`/login?error=${code}`);
      const alert = page.getByRole("alert").filter({ hasText: "That sign-in link didn't work" });
      await expect(alert).toBeVisible();
      await expect(alert).toContainText("It expired or was already used. Get a new one, or sign in with Google.");
      await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
      await page.getByRole("button", { name: "Send a new email link" }).click();
      await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
    });
  }

  for (const size of [
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    test(`sheet buttons are on screen and not covered at ${size.width}x${size.height}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto("/login");
      await expect.poll(() => fullyTappable(page, page.getByRole("button", { name: "Continue with Google" }))).toBe(true);
      await expect.poll(() => fullyTappable(page, page.getByRole("button", { name: "Use email instead" }))).toBe(true);
      await page.goto("/login?error=link");
      await expect.poll(() => fullyTappable(page, page.getByRole("button", { name: "Continue with Google" }))).toBe(true);
    });
  }

  test("with the keyboard open (short viewport), the email button stays in view", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/login");
    await page.getByRole("button", { name: "Use email instead" }).click();
    // The on-screen keyboard leaves about 340px (interactive-widget=resizes-content).
    await page.setViewportSize({ width: 360, height: 340 });
    await page.getByLabel("Email", { exact: true }).focus();
    const send = page.getByRole("button", { name: "Email me a sign-in link" });
    await expect.poll(() => fullyTappable(page, send)).toBe(true);
    await expect(page.locator("[data-login-court]")).toBeHidden();
  });

  test("an unsafe next value is ignored", async ({ page }) => {
    await page.goto("/login?next=//evil.example");
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  });

  test("the design system stays public", async ({ page }) => {
    await page.goto("/design-system");
    await expect(page).toHaveURL(/\/design-system$/);
  });

  for (const [path, title] of [
    ["/terms", "Terms"],
    ["/privacy", "Privacy Policy"],
  ] as const) {
    test(`${path} loads signed out, with the draft line and a way back`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(page.getByText(/^Draft · last updated /)).toBeVisible();
      await expect(page.getByRole("img", { name: "Pilaball" })).toBeVisible();
      await expect(page).toHaveTitle(`${title} · Pilaball`);
      await page.getByRole("link", { name: "Sign in" }).click();
      await expect(page).toHaveURL(/\/login$/);
    });
  }
});
