import { expect, test, type Page } from "@playwright/test";
import { startSession } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

// D20: English by default, Taglish as the second language, chosen per device (cookie).

const htmlLang = (page: Page) => page.locator("html");

test("organizer: Settings › Language switches to Taglish, survives a reload, and back to English", async ({ page }) => {
  await signInWithNewClub(page, "lang", "Lang Club");
  await expect(htmlLang(page)).toHaveAttribute("lang", "en");
  await expect(page.getByRole("link", { name: "New session" })).toBeVisible();

  await page.getByRole("navigation", { name: "Main menu" }).getByRole("link", { name: "Settings" }).click();
  const language = page.getByRole("radiogroup", { name: "Language" });
  await expect(language.getByRole("radio", { name: "English" })).toHaveAttribute("aria-checked", "true");
  await language.getByRole("radio", { name: "Taglish" }).click();

  // The page switches without a reload; the label and <html lang> follow.
  const wika = page.getByRole("radiogroup", { name: "Wika" });
  await expect(wika.getByRole("radio", { name: "Taglish" })).toHaveAttribute("aria-checked", "true");
  await expect(htmlLang(page)).toHaveAttribute("lang", "fil");

  // Kept after a reload, and on every page.
  await page.reload();
  await expect(htmlLang(page)).toHaveAttribute("lang", "fil");
  await expect(wika.getByRole("radio", { name: "Taglish" })).toHaveAttribute("aria-checked", "true");
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Bagong open play" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Mga susunod" })).toBeVisible();

  // Back to English.
  await page.goto("/settings");
  await wika.getByRole("radio", { name: "English" }).click();
  await expect(page.getByRole("radiogroup", { name: "Language" }).getByRole("radio", { name: "English" })).toHaveAttribute("aria-checked", "true");
  await expect(htmlLang(page)).toHaveAttribute("lang", "en");
  await page.goto("/");
  await expect(page.getByRole("link", { name: "New session" })).toBeVisible();
});

test("player: the EN | TL switch on check-in, kept after reload, separate from the organizer's phone", async ({ page: organizer, browser }) => {
  await signInWithNewClub(organizer, "langplayer", "Lang Player Club");
  await startSession(organizer, "Lang Night", { courts: 1 });
  await organizer.getByRole("link", { name: "Show QR" }).click();
  const path = new URL((await organizer.getByText(/\/j\/[A-Z2-9]{6}$/).textContent())!).pathname;

  const player = await (await browser.newContext()).newPage();
  await player.goto(path);
  await expect(htmlLang(player)).toHaveAttribute("lang", "en");
  await expect(player.getByRole("button", { name: "Join queue" })).toBeVisible();
  const switcher = player.getByRole("radiogroup", { name: "Language" });
  await expect(switcher.getByRole("radio", { name: "English" })).toHaveText("EN");
  await switcher.getByRole("radio", { name: "Taglish" }).click();

  await expect(player.getByRole("button", { name: "Pumila na" })).toBeVisible();
  await expect(player.getByLabel("Pangalan mo")).toBeVisible();
  await expect(htmlLang(player)).toHaveAttribute("lang", "fil");

  await player.reload();
  await expect(player.getByRole("button", { name: "Pumila na" })).toBeVisible();
  await expect(htmlLang(player)).toHaveAttribute("lang", "fil");

  // Joining keeps the language on My place, which has the switch too.
  await player.getByLabel("Pangalan mo").fill("Tess Tagalog");
  await player.getByRole("radio", { name: "Cash", exact: true }).check();
  await player.getByRole("button", { name: "Pumila na" }).click();
  await expect(player.getByRole("button", { name: "Pahinga muna" })).toBeVisible();
  await player.getByRole("radiogroup", { name: "Wika" }).getByRole("radio", { name: "English" }).click();
  await expect(player.getByRole("button", { name: "Take a break" })).toBeVisible();
  await expect(htmlLang(player)).toHaveAttribute("lang", "en");

  // The organizer's phone was never switched.
  await organizer.reload();
  await expect(organizer.getByText("Scan to join").filter({ visible: true })).toBeVisible();
  await expect(htmlLang(organizer)).toHaveAttribute("lang", "en");
  await player.context().close();
});
