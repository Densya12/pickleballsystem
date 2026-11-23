import { expect, test } from "@playwright/test";

test("design system page shows its heading and buttons", async ({ page }) => {
  await page.goto("/design-system");

  await expect(page.getByRole("heading", { level: 1, name: "Design System" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mag-check in na" })).toBeVisible();
});
