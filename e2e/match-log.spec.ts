import { expect, test, type Page } from "@playwright/test";
import { addWalkIn, court, finishGame, onCourt, openMore, openTab, SESSION_URL, startSession } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

// D27: Match log and Standings. The organizer finishes a game, opens Games &
// standings from More, corrects the result and the teams; the standings follow,
// live on a player's phone too. Courts and the queue stay as they were.
// Screenshots at 390x844 go to docs/qa/img/d27-*.png.

const SIZE = { width: 390, height: 844 };
const shot = (page: Page, name: string) => page.screenshot({ path: `docs/qa/img/d27-${name}.png`, fullPage: true });

/** The standings as "rank name W-L/games" lines. */
async function standings(page: Page): Promise<string[]> {
  const rows = page.getByTestId("standings").locator("tbody tr");
  return rows.evaluateAll((trs) =>
    trs.map((tr) => {
      const [rank, w, l, g] = [...tr.querySelectorAll("td")].map((td) => td.textContent?.trim() ?? "");
      const name = tr.querySelector("th")?.firstChild?.textContent?.trim() ?? "";
      return `${rank} ${name} ${w}-${l}/${g}`;
    }),
  );
}

test("organizer corrects a game in Games & standings; a player sees the standings update", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await page.setViewportSize(SIZE);
  await signInWithNewClub(page, "d27-log", "Log Club");
  await startSession(page, "Log Night", { courts: 1 });

  // Pia checks in on her phone; three walk-ins.
  await page.getByRole("link", { name: "Show QR" }).click();
  const path = new URL((await page.getByText(/\/j\/[A-Z2-9]{6}(?:[A-Z2-9]{2})?$/).textContent())!).pathname;
  await page.goBack();
  await expect(page).toHaveURL(SESSION_URL);
  const pia = await (await browser.newContext({ viewport: SIZE })).newPage();
  await pia.goto(path);
  await pia.getByLabel("Name", { exact: true }).fill("Pia");
  await pia.getByRole("button", { name: "Join queue" }).click();
  await expect(pia.getByTestId("position")).toBeVisible();
  for (const name of ["Ana", "Ben", "Cy"]) await addWalkIn(page, name);

  // Game 1: Pia + Ana beat Ben + Cy. (Call next automatically: game 2 starts with the same four.)
  await openTab(page, "Courts");
  await court(page, "Court 1").getByRole("button", { name: "Call next 4" }).click();
  await expect(onCourt(page, "Court 1")).toHaveText(["Pia", "Ana", "Ben", "Cy"]);
  await finishGame(page, "Court 1", ["Pia", "Ana"]);
  await expect(onCourt(page, "Court 1")).toHaveCount(4);
  const onCourtBefore = await onCourt(page, "Court 1").allTextContents();

  // More › Games & standings.
  const more = await openMore(page);
  await more.getByRole("link", { name: "Games & standings" }).click();
  await expect(page).toHaveURL(/\/s\/[0-9a-f-]+\/games$/);
  await expect(page.getByRole("heading", { level: 1, name: "Games & standings" })).toBeVisible();
  const game1 = page.locator('[data-game="1"]');
  await expect(game1).toContainText(/Game 1 · Court 1 · \d{1,2}:\d{2}/);
  await expect(game1).toContainText("Pia + Ana vs Ben + Cy");
  await expect(game1.getByTestId("result")).toHaveText("Pia + Ana won");
  // The running game 2 is on Courts, not in the log.
  await expect(page.locator('[data-game="2"]')).toHaveCount(0);
  await expect(page.getByText("Wins first. Games with no result don't count as a win or a loss.")).toBeVisible();
  await expect.poll(() => standings(page)).toEqual(["1 Ana 1-0/1", "1 Pia 1-0/1", "3 Ben 0-1/1", "3 Cy 0-1/1"]);
  await shot(page, "games-standings");

  // Pia (called again for game 2) taps On my way, then opens Standings from My place (read-only).
  await pia.getByRole("button", { name: "On my way" }).click();
  await pia.getByRole("link", { name: "Standings" }).click();
  await expect(pia.getByRole("heading", { level: 1, name: "Standings" })).toBeVisible();
  await expect(pia.locator("[data-me]")).toContainText("Pia");
  await expect(pia.getByRole("button", { name: /Correct/ })).toHaveCount(0);
  await expect.poll(() => standings(pia)).toEqual(["1 Ana 1-0/1", "1 Pia 1-0/1", "3 Ben 0-1/1", "3 Cy 0-1/1"]);

  // Correct the result: the right side won.
  await game1.getByRole("button", { name: "Correct game 1" }).click();
  const sheet = page.getByRole("dialog", { name: "Correct game 1" });
  await expect(sheet.getByRole("radio", { name: /^Left won/ })).toBeChecked();
  await sheet.getByRole("radio", { name: /^Right won/ }).check();
  await shot(page, "correct-sheet");
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Fixed. This changes the record only. Courts and the queue stay as they are.")).toBeVisible();
  await expect(game1.getByTestId("result")).toHaveText("Ben + Cy won");
  await expect.poll(() => standings(page)).toEqual(["1 Ben 1-0/1", "1 Cy 1-0/1", "3 Ana 0-1/1", "3 Pia 0-1/1"]);
  // Live on Pia's phone.
  await expect.poll(() => standings(pia), { timeout: 5_000 }).toEqual(["1 Ben 1-0/1", "1 Cy 1-0/1", "3 Ana 0-1/1", "3 Pia 0-1/1"]);
  await shot(pia, "player-standings");

  // Fix teams: it was really Pia + Ben vs Ana + Cy, and Pia + Ben won.
  await game1.getByRole("button", { name: "Correct game 1" }).click();
  await sheet.getByRole("group", { name: "Fix teams · Pia's partner" }).getByRole("radio", { name: "Ben" }).check();
  await expect(sheet.getByRole("radio", { name: /^Left won/ })).toHaveAccessibleName(/Pia \+ Ben/);
  await sheet.getByRole("radio", { name: /^Left won/ }).check();
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(game1).toContainText("Pia + Ben vs Ana + Cy");
  await expect(game1.getByTestId("result")).toHaveText("Pia + Ben won");
  await expect.poll(() => standings(page)).toEqual(["1 Ben 1-0/1", "1 Pia 1-0/1", "3 Ana 0-1/1", "3 Cy 0-1/1"]);

  // No result: counts in games only.
  await game1.getByRole("button", { name: "Correct game 1" }).click();
  await sheet.getByRole("radio", { name: /^No result/ }).check();
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(game1.getByTestId("result")).toHaveText("No result");
  await expect.poll(() => standings(page)).toEqual(["1 Ana 0-0/1", "1 Ben 0-0/1", "1 Cy 0-0/1", "1 Pia 0-0/1"]);

  // Courts and the queue stay as they were.
  await page.getByRole("link", { name: "Courts" }).first().click();
  await expect(page).toHaveURL(SESSION_URL);
  await expect(onCourt(page, "Court 1")).toHaveText(onCourtBefore);
  await pia.context().close();
});
