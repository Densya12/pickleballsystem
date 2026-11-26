import { expect, test, type Page } from "@playwright/test";
import { signInWithNewClub } from "./support/organizer";

// D21: the app is Pilaball. The old name must not appear anywhere a user sees it:
// page text, page titles or the installable app's manifest.
const OLD_NAME = /Open Play Queue/i;

async function expectNoOldName(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  expect(await page.title(), `title of ${path}`).not.toMatch(OLD_NAME);
  expect(await page.locator("body").innerText(), `text of ${path}`).not.toMatch(OLD_NAME);
  expect(await page.locator("html").getAttribute("lang")).toBeTruthy();
}

test("the old name 'Open Play Queue' appears nowhere in the rendered UI", async ({ page, request }) => {
  test.setTimeout(90_000);
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.name).toBe("Pilaball");
  expect(manifest.short_name).toBe("Pilaball");
  expect(JSON.stringify(manifest)).not.toMatch(OLD_NAME);
  expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === "maskable")).toBe(true);

  for (const path of ["/login", "/login?error=link", "/terms", "/privacy", "/design-system", "/j/ZZZZZZ", "/c/ZZZZZZ", "/no-such-page"]) {
    await expectNoOldName(page, path);
  }

  await signInWithNewClub(page, "brand", "Brand Club");
  await expect(page.getByRole("img", { name: "Pilaball" })).toBeVisible();
  await expect(page).toHaveTitle("Pilaball");
  for (const path of ["/", "/settings", "/guide", "/members", "/sessions/new", "/settings/qr"]) {
    await expectNoOldName(page, path);
  }
});

test("Taglish: the sign-in headline and Terms/Privacy", async ({ page, context }) => {
  await context.addCookies([{ name: "opq-lang", value: "fil", url: "http://localhost" }]);
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1, name: "Open play, isang patas na pila." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mag-sign in gamit ang Google" })).toBeVisible();
});
