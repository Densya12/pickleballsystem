import { expect, test, type Browser, type Page } from "@playwright/test";
import { addWalkIn, banner, court, finishGame, onCourt, openMore, openTab, queueSection, SESSION_URL, startSession } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

// D26: "Wait for me": Done frees the court, the organizer taps Call. Winners
// stay on court as "staying". Phones ring only at Call. Screenshots at 390x844
// go to docs/qa/img/d26-*.png.

const SIZE = { width: 390, height: 844 };
const shot = (page: Page, name: string) => page.screenshot({ path: `docs/qa/img/d26-${name}.png` });

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

test("Wait for me, All off: Done leaves the court empty with Call; the phone rings only at Call; Ready to call", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await page.clock.install();
  await page.setViewportSize(SIZE);
  await signInWithNewClub(page, "d26-wait", "Wait Club");

  // New clubs start on "Wait for me".
  await page.getByRole("link", { name: "New session" }).click();
  await expect(page.getByRole("group", { name: "Next game" }).getByRole("radio", { name: /^Wait for me/ })).toBeChecked();
  await page.goBack();
  await startSession(page, "Wait Night", { courts: 1, callMode: "Wait for me" });
  const path = await joinPath(page);

  for (const name of ["Ana", "Ben", "Cy", "Dee"]) await addWalkIn(page, name);
  const pia = await phone(browser);
  await checkIn(pia, path, "Pia");
  for (const name of ["Eli", "Fe"]) await addWalkIn(page, name);

  // Queue tab: "Next" is the only filled lime pill; Pia's "New" is a grey outline.
  await openTab(page, "Queue");
  const piaRow = queueSection(page, "After that").getByRole("listitem").filter({ hasText: "Pia" });
  await expect(piaRow.getByTestId("new-tag")).toHaveText("New");
  const next = queueSection(page, "Up next").getByRole("listitem").first().getByTestId("next-tag");
  await expect(next).toHaveCSS("background-color", "rgb(201, 242, 107)");
  await expect(piaRow.getByTestId("new-tag")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await shot(page, "queue-new-next");

  await openTab(page, "Courts");
  await court(page, "Court 1").getByRole("button", { name: "Call next 4" }).click();
  await expect(onCourt(page, "Court 1")).toHaveText(["Ana", "Ben", "Cy", "Dee"]);

  // Done: the result is recorded, nothing is called.
  await finishGame(page, "Court 1", ["Ana", "Ben"]);
  await expect(banner(page)).toHaveText(/Game #1 on Court 1 is done\. Won: Ana and Ben\. Tap Call on Court 1 when you're ready\./);
  const c1 = court(page, "Court 1");
  await expect(c1.getByText("Doubles · Empty")).toBeVisible();
  await expect(c1.getByTestId("court-next")).toHaveText("Next: Pia, Eli, Fe, Ana");
  await expect(c1.getByRole("button", { name: "Call next 4" })).toBeVisible();
  await expect(c1).not.toHaveAttribute("data-ready-to-call");
  // Pia is in the next group but nobody was called: her phone doesn't ring.
  await expect(pia.locator('[data-state="queued"]')).toBeVisible();
  await expect(pia.getByRole("alert").filter({ hasText: "You're up" })).toHaveCount(0);
  await shot(page, "empty-court-call");

  // Over 2 minutes with a group ready: a gentle "Ready to call" (no sound).
  await page.clock.fastForward("02:30");
  await expect(c1).toHaveAttribute("data-ready-to-call", "true");
  await expect(c1.getByTestId("ready-to-call")).toHaveText("Ready to call");
  await shot(page, "ready-to-call");

  // Call: the D25 selection; Pia's phone rings now.
  await c1.getByRole("button", { name: "Call next 4" }).click();
  await expect(banner(page)).toHaveText(/Called to Court 1: Pia, Eli, Fe, Ana/);
  await expect(onCourt(page, "Court 1")).toHaveText(["Pia", "Eli", "Fe", "Ana"]);
  await expect(pia.getByRole("alert").filter({ hasText: "You're up" })).toBeVisible({ timeout: 5_000 });
  await pia.context().close();
});

test("Wait for me, Winners stay: winners stay as 'staying', Call 2 fills the other side; the More setting", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await page.setViewportSize(SIZE);
  await signInWithNewClub(page, "d26-stay", "Stay Club");
  await startSession(page, "Stay Night", { courts: 1, winnersStay: true, callMode: "Wait for me" });
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
  await expect(banner(page)).toHaveText(/Won: Wes and Ana\. Wes and Ana stay on\. Tap Call on Court 1 when you're ready\./);
  const c1 = court(page, "Court 1");
  await expect(c1.locator('[data-chip="staying"]')).toHaveText(["Wes· staying", "Ana· staying"]);
  await expect(onCourt(page, "Court 1")).toHaveText(["Wes, staying", "Ana, staying"]);
  await expect(c1.getByText("Doubles · Waiting for Call")).toBeVisible();
  await expect(c1.getByTestId("court-next")).toHaveText("Wes + Ana stay on · Next: Dee, Eli");
  await expect(c1.getByRole("button", { name: /^Make it/ })).toHaveCount(0);
  // Wes's phone: he stays on; no ring until Call.
  await expect(wes.getByRole("heading", { level: 1, name: "You won! Stay on Court 1" })).toBeVisible({ timeout: 5_000 });
  await expect(wes.getByTestId("staying")).toContainText("Left side · with Ana");
  await shot(page, "winners-staying");
  await shot(wes, "player-staying");

  // Call 2: Dee and Eli join on the other side; the phone rings for the new game.
  await c1.getByRole("button", { name: "Call 2 · Court 1" }).click();
  await expect(onCourt(page, "Court 1")).toHaveText(["Wes", "Ana", "Dee", "Eli"]);
  await expect(wes.getByRole("alert").filter({ hasText: "You're up" })).toBeVisible({ timeout: 5_000 });

  // More: Next game, while live.
  const more = await openMore(page);
  const setting = more.getByRole("group", { name: "Next game" });
  await expect(setting.getByRole("radio", { name: /^Wait for me/ })).toBeChecked();
  await setting.getByRole("radio", { name: /^Call next automatically/ }).check();
  await expect(banner(page)).toHaveText(/Next game: Call next automatically\. It applies from the next Done\./);
  await page.keyboard.press("Escape");

  // Now auto-call. A 2nd win in a row after the delayed call: everyone goes off (winners first),
  // and the next group is called at Done (Fair line: Ben, Cy, then Wes and Ana).
  await finishGame(page, "Court 1", ["Wes", "Ana"]);
  await expect(banner(page)).toHaveText(/Called: Ben, Cy, Wes, Ana/);
  await expect(onCourt(page, "Court 1")).toHaveText(["Ben", "Cy", "Wes", "Ana"]);
  await wes.context().close();
});
