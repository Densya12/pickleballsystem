import { expect, test } from "@playwright/test";

test.describe("signed-out visitor", () => {
  test("visiting / redirects to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { level: 1, name: "Mag-sign in bilang organizer" })).toBeVisible();
  });

  test("private pages redirect to /login and remember where to return", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login\?next=%2Fsettings$/);
  });

  test("/login shows both sign-in options", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByText("Para sa nag-aayos ng open play. Hindi kailangang mag-sign in ng mga player."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Mag-sign in gamit ang Google" })).toBeVisible();
    await expect(page.getByLabel("Email mo")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ipadala ang login link" })).toBeVisible();
  });

  test("an unsafe next value is ignored", async ({ page }) => {
    await page.goto("/login?next=//evil.example");
    await expect(page.getByRole("button", { name: "Mag-sign in gamit ang Google" })).toBeVisible();
  });

  test("the design system stays public", async ({ page }) => {
    await page.goto("/design-system");
    await expect(page).toHaveURL(/\/design-system$/);
  });
});
