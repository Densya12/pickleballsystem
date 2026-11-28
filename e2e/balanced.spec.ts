import { expect, test, type Page } from "@playwright/test";
import { addWalkIn, banner, court, onCourt, openMore, openTab, SESSION_URL, startSession } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

// D29 Balanced teams and D30 level descriptions. Screenshots go to docs/qa/img/d29-*.png and d30-*.png.

const shot = (page: Page, name: string) => page.screenshot({ path: `docs/qa/img/${name}.png`, fullPage: true });

test("Balanced teams: Settings and More list it after Mixed; levels 4, 2, 3, 3 play 4+2 vs 3+3", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await signInWithNewClub(page, "d29-balanced", "Balanced Club");

  // Settings › Club details: the default for new sessions, right after Mixed.
  await page.getByRole("navigation", { name: "Main menu" }).getByRole("link", { name: "Settings" }).click();
  await page.getByRole("link", { name: /Club details/ }).click();
  const defaults = page.getByRole("group", { name: "Who plays together" });
  await expect(defaults.getByRole("radio")).toHaveCount(4);
  const names = await defaults.getByRole("radio").evaluateAll((radios) => radios.map((r) => (r as HTMLInputElement).value));
  expect(names).toEqual(["mixed", "balanced", "same_level", "fair_line"]);
  await expect(defaults).toContainText("Levels can mix. Teams are made even.");
  await page.goto("/");

  await startSession(page, "Balanced Night", { courts: 1, preset: "Balanced teams" });
  for (const [name, level] of [
    ["Ana", "Level 4"],
    ["Ben", "Level 2"],
    ["Cy", "Level 3"],
    ["Dee", "Level 3"],
  ] as const) {
    await addWalkIn(page, name, level);
  }
  await openTab(page, "Courts");
  await court(page, "Court 1").getByRole("button", { name: "Call next 4" }).click();
  // Mixed would have no group (levels 2-4); Balanced teams plays 4+2 vs 3+3 (Ana and Ben on the left).
  await expect(onCourt(page, "Court 1")).toHaveText(["Ana", "Ben", "Cy", "Dee"]);
  await expect(banner(page)).toHaveText(/Called to Court 1: Ana, Ben, Cy, Dee/);
  await shot(page, "d29-balanced-teams");

  // More: the session's control lists it after Mixed, checked.
  const more = await openMore(page);
  const presets = more.getByRole("group", { name: "Who plays together" });
  await expect(presets.getByRole("radio", { name: /^Balanced teams/ })).toBeChecked();
  const order = await presets.getByRole("radio").evaluateAll((radios) => radios.map((r) => (r as HTMLInputElement).value));
  expect(order).toEqual(["mixed", "balanced", "same_level", "fair_line"]);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(SESSION_URL);
});

test("a player picking a level sees what each level means, wrapped at 360 px", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await signInWithNewClub(page, "d30-levels", "Levels Club");
  await startSession(page, "Levels Night", { courts: 1 });
  await page.getByRole("link", { name: "Show QR" }).click();
  const path = new URL((await page.getByText(/\/j\/[A-Z2-9]{6}(?:[A-Z2-9]{2})?$/).textContent())!).pathname;

  const player = await (await browser.newContext({ viewport: { width: 360, height: 780 } })).newPage();
  await player.goto(path);
  const picker = player.getByRole("group", { name: "Level (optional)" });
  await expect(picker.getByRole("radio", { name: "Level 1" })).toHaveAccessibleDescription(
    "New to pickleball: learning to serve and keep a rally going.",
  );
  for (const text of [
    "New to pickleball: learning to serve and keep a rally going.",
    "Can rally and keep score; still learning the kitchen.",
    "Steady rallies; dinks and plays at the net on purpose.",
    "Strong all-round: places shots, quick at the net, few errors.",
    "Tournament level: plays in leagues or tournaments.",
  ]) {
    await expect(picker.getByText(text, { exact: true })).toBeVisible();
  }
  await picker.getByRole("radio", { name: "Level 3" }).check();
  await expect(player.getByTestId("level-description")).toHaveText("Level 3: Steady rallies; dinks and plays at the net on purpose.");
  // The chosen row's radio dot is filled (ink), the others aren't.
  await expect(picker.locator('input[value="3"] + span')).toHaveCSS("background-color", "rgb(17, 20, 18)");
  await expect(picker.locator('input[value="2"] + span')).not.toHaveCSS("background-color", "rgb(17, 20, 18)");
  // Nothing is cut off: no sideways scroll, and every description wraps inside the screen.
  expect(await player.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  const overflow = await picker.locator("[id$='-d4']").evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(overflow).toBe(false);
  await shot(player, "d30-level-descriptions");

  // Taglish.
  await player.context().addCookies([{ name: "opq-lang", value: "fil", url: new URL(player.url()).origin }]);
  await player.reload();
  await expect(player.getByText("Tuloy-tuloy ang rally; marunong mag-dink at maglaro sa net.", { exact: true })).toBeVisible();
  await player.context().close();
});
