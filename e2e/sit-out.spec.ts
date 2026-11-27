import { expect, test, type Browser, type Page } from "@playwright/test";
import { addWalkIn, banner, court, finishGame, onCourt, openTab, SESSION_URL, startSession } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

// D26 follow-up: a staying winner can sit out the next game: from their phone
// ("Sit out this game") or the organizer's "Send to line". Screenshots at
// 390x844 go to docs/qa/img/d26-sit-out-*.png.

const SIZE = { width: 390, height: 844 };
const shot = (page: Page, name: string) => page.screenshot({ path: `docs/qa/img/d26-sit-out-${name}.png` });

async function phone(browser: Browser) {
  const context = await browser.newContext({ viewport: SIZE });
  return context.newPage();
}

async function joinPath(page: Page): Promise<string> {
  await page.getByRole("link", { name: "Show QR" }).click();
  const path = new URL((await page.getByText(/\/j\/[A-Z2-9]{6}(?:[A-Z2-9]{2})?$/).textContent())!).pathname;
  await page.goBack();
  await expect(page).toHaveURL(SESSION_URL);
  return path;
}

async function checkIn(player: Page, path: string, name: string) {
  await player.goto(path);
  await player.getByLabel("Name", { exact: true }).fill(name);
  await player.getByRole("button", { name: "Join queue" }).click();
  await expect(player.getByTestId("position")).toBeVisible();
}

/** Wait for me + Winners stay, 1 court: Wes (on his phone) and Ana win and stay; Ben, Cy, Dee, Eli wait. */
async function winnersStaying(page: Page, browser: Browser, club: string) {
  await page.setViewportSize(SIZE);
  await signInWithNewClub(page, club, "Sit Club");
  await startSession(page, "Sit Night", { courts: 1, winnersStay: true, callMode: "Wait for me" });
  const path = await joinPath(page);
  const wes = await phone(browser);
  await checkIn(wes, path, "Wes");
  for (const name of ["Ana", "Ben", "Cy", "Dee", "Eli"]) await addWalkIn(page, name);
  await openTab(page, "Courts");
  await court(page, "Court 1").getByRole("button", { name: "Call next 4" }).click();
  await expect(onCourt(page, "Court 1")).toHaveText(["Wes", "Ana", "Ben", "Cy"]);
  await expect(wes.getByRole("alert").filter({ hasText: "You're up" })).toBeVisible({ timeout: 5_000 });
  await wes.getByRole("button", { name: "On my way" }).click();
  await finishGame(page, "Court 1", ["Wes", "Ana"]);
  await expect(court(page, "Court 1").locator('[data-chip="staying"]')).toHaveText(["Wes· staying", "Ana· staying"]);
  return wes;
}

test("the winner taps Sit out on their phone: back in line, and the court shows Call 3", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const wes = await winnersStaying(page, browser, "sit-phone");

  await expect(wes.getByRole("heading", { level: 1, name: "You won! Stay on Court 1" })).toBeVisible({ timeout: 5_000 });
  await wes.getByRole("button", { name: "Sit out this game" }).click();
  const ask = wes.getByRole("group", { name: "Sit out the next game? You go to the back of the line." });
  await expect(ask).toBeVisible();
  await shot(wes, "phone");
  await ask.getByRole("button", { name: "Yes, sit out" }).click();
  // Back in line, last (behind the losers, like anyone who just finished a game).
  await expect(wes.locator('[data-state="queued"]')).toBeVisible({ timeout: 5_000 });
  await expect(wes.getByTestId("position")).toContainText("5");

  // The organizer's court (live): Ana stays; Call fills 3.
  const c1 = court(page, "Court 1");
  await expect(c1.locator('[data-chip="staying"]')).toHaveText(["Ana· staying"], { timeout: 5_000 });
  await expect(c1.getByTestId("court-next")).toHaveText("Ana stays on · Next: Dee, Eli, Ben");
  await expect(c1.getByRole("button", { name: "Call 3 · Court 1" })).toBeVisible();
  await shot(page, "call-3");

  await c1.getByRole("button", { name: "Call 3 · Court 1" }).click();
  await expect(onCourt(page, "Court 1")).toHaveText(["Ana", "Dee", "Eli", "Ben"]);
  await wes.context().close();
});

test("the organizer taps a staying chip, then Send to line (English and Taglish)", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const wes = await winnersStaying(page, browser, "sit-staff");
  const c1 = court(page, "Court 1");

  await c1.getByRole("button", { name: "Ana, staying. Tap to send to the line" }).click();
  const ask = c1.getByRole("group", { name: "Send Ana to the line? They sit out the next game." });
  await expect(ask).toBeVisible();
  await shot(page, "send-to-line");
  await ask.getByRole("button", { name: "Send to line" }).click();
  await expect(banner(page)).toHaveText(/Ana is back in line\. Call will fill 3 spots\./);
  await expect(c1.locator('[data-chip="staying"]')).toHaveText(["Wes· staying"]);
  await expect(c1.getByRole("button", { name: "Call 3 · Court 1" })).toBeVisible();
  // Wes still stays (his phone too).
  await expect(wes.getByRole("heading", { level: 1, name: "You won! Stay on Court 1" })).toBeVisible();

  // Taglish: send Wes too; nobody stays, the court is empty and waiting, Call takes 4.
  await page.context().addCookies([{ name: "opq-lang", value: "fil", url: new URL(page.url()).origin }]);
  await page.reload();
  await c1.getByRole("button", { name: "Wes, mananatili. Pindutin para ibalik sa pila" }).click();
  await c1.getByRole("group", { name: /^Ibalik si Wes sa pila\?/ }).getByRole("button", { name: "Ibalik sa pila" }).click();
  await expect(banner(page)).toHaveText(/Nasa pila na ulit si Wes\. Pupunuin ng Call ang 4 na puwesto\./);
  await expect(c1.locator('[data-chip="staying"]')).toHaveCount(0);
  await expect(wes.locator('[data-state="queued"]')).toBeVisible({ timeout: 5_000 });
  await expect(c1.getByRole("button", { name: /^Tawagin/ })).toBeVisible();
  await wes.context().close();
});
