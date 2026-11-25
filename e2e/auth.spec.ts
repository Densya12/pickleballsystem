import { expect, test } from "@playwright/test";

test.describe("signed-out visitor", () => {
  test("visiting / redirects to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  });

  test("private pages redirect to /login and remember where to return", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login\?next=%2Fsettings$/);
  });

  test("/login shows both sign-in options", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByText("For the people who run open play. Players don't need to sign in."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible();
  });

  test("an unsafe next value is ignored", async ({ page }) => {
    await page.goto("/login?next=//evil.example");
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  });

  test("the design system stays public", async ({ page }) => {
    await page.goto("/design-system");
    await expect(page).toHaveURL(/\/design-system$/);
  });
});
