import { expect, test, type Browser, type Page } from "@playwright/test";
import { addWalkIn, banner, court, onCourt, openMore, openPlayer, openTab, queueRows, queueSection } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

// Phase 9 (D25): levels 1-5, presets, group selection with an explaining banner,
// teams and "Who won?" by side, the team swap, the organizer's level change,
// Call mixed. Screenshots at 390x844 go to docs/qa/img/phase9-*.png.

const SIZE = { width: 390, height: 844 };
const SAME_LEVEL_NOTE = "Courts may wait for a same-level group. Mixed works best for most sessions.";
const shot = (page: Page, name: string) => page.screenshot({ path: `docs/qa/img/phase9-${name}.png` });

async function phone(browser: Browser) {
  const context = await browser.newContext({ viewport: SIZE });
  return context.newPage();
}

async function newSession(page: Page, name: string, preset: "Mixed" | "Same level" | "Fair line", screenshot?: string) {
  await page.getByRole("link", { name: "New session" }).click();
  await page.getByLabel("Session name").fill(name);
  await page.getByRole("button", { name: "Fewer courts" }).click();
  const presets = page.getByRole("group", { name: "Who plays together" });
  // New clubs start on Mixed.
  await expect(presets.getByRole("radio", { name: /^Mixed/ })).toBeChecked();
  await expect(presets).toContainText("Levels within 1 of each other, with new partners");
  await expect(presets.getByText(SAME_LEVEL_NOTE)).toBeVisible();
  await presets.getByRole("radio", { name: new RegExp(`^${preset}`) }).check();
  if (screenshot) {
    await presets.scrollIntoViewIfNeeded();
    await shot(page, screenshot);
  }
  // D26: these checks expect the next group to be called at Done (auto-call).
  await page.getByRole("radio", { name: /^Call next automatically/ }).check();
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page).toHaveURL(/\/s\/[0-9a-f-]{36}$/);
}

test("Mixed: levels, the next group and why, teams, Who won by side, team swap, level change, preset in More", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await page.setViewportSize(SIZE);
  await signInWithNewClub(page, "phase9", "Level Club");
  await newSession(page, "Mixed Night", "Mixed", "new-session-preset");

  await page.getByRole("link", { name: "Show QR" }).click();
  const path = new URL((await page.getByText(/\/j\/[A-Z2-9]{6}(?:[A-Z2-9]{2})?$/).textContent())!).pathname;
  await page.goBack();

  // Ana (3) as a walk-in, then Bea checks in on her phone and picks level 5 from the keyboard.
  await addWalkIn(page, "Ana", "Level 3");
  const bea = await phone(browser);
  await bea.goto(path);
  await bea.getByLabel("Name", { exact: true }).fill("Bea");
  const levels = bea.getByRole("group", { name: /^Level/ });
  await expect(levels).toHaveAccessibleDescription("Same as your stars in your club app.");
  for (const n of [1, 2, 3, 4, 5]) await expect(levels.getByRole("radio", { name: `Level ${n}` })).toBeVisible();
  await expect(levels.getByRole("radio", { name: "Not sure" })).toBeVisible();
  await bea.keyboard.press("Tab");
  await expect(levels.getByRole("radio", { name: "Level 1" })).toBeFocused();
  for (let i = 0; i < 4; i++) await bea.keyboard.press("ArrowRight");
  await expect(levels.getByRole("radio", { name: "Level 5" })).toBeChecked();
  await shot(bea, "checkin-level");
  await bea.getByRole("button", { name: "Join queue" }).click();
  await expect(bea.getByTestId("position")).toBeVisible();

  for (const [name, level] of [["Cy", "Level 2"], ["Dee", "Level 3"], ["Eli", "Level 4"]] as const) await addWalkIn(page, name, level);
  const fe = await phone(browser);
  await fe.goto(path);
  await fe.getByLabel("Name", { exact: true }).fill("Fe");
  await fe.getByRole("radio", { name: "Level 3" }).check();
  await fe.getByRole("button", { name: "Join queue" }).click();
  await expect(fe.getByTestId("position")).toBeVisible();

  // Queue: a level badge on every row; true queue order, the server's group tagged Next in place
  // (Bea, level 5, and Eli, level 4, wait for their level group).
  await openTab(page, "Queue");
  await expect(queueRows(page).filter({ hasText: "Bea" })).toContainText("Level 5");
  await expect(queueSection(page, "Up next").getByRole("listitem")).toHaveText([/^#?1Ana/, /^#?2Bea/, /^#?3Cy/, /^#?4Dee/, /^#?5Eli/, /^#?6Fe/]);
  await expect(queueSection(page, "Up next").getByRole("listitem").filter({ has: page.getByTestId("next-tag") })).toHaveText([/Ana/, /Cy/, /Dee/, /Fe/]);
  await expect(page.getByText("Not sure").filter({ visible: true })).toHaveCount(0);
  await shot(page, "queue-levels");

  // Bea is 2nd in line but not in the next group: the player sees why.
  await expect(bea.getByTestId("wait-band")).toHaveText("You're 2nd in line. Waiting for a level 4–5 group.", { timeout: 5_000 });
  await shot(bea, "player-band");

  // Courts: Up next with its level range; the call explains itself.
  await openTab(page, "Courts");
  await expect(page.getByText("Ana, Cy, Dee, Fe · levels 2–3")).toBeVisible();
  await court(page, "Court 1").getByRole("button", { name: "Call next 4" }).click();
  await expect(banner(page)).toHaveText(/Called to Court 1: Ana, Cy, Dee, Fe · levels 2–3 · haven't played together/);
  // Balanced teams: Ana + Cy (3+2) on the left, Dee + Fe (3+3) on the right.
  await expect(onCourt(page, "Court 1")).toHaveText(["Ana", "Cy", "Dee", "Fe"]);
  await shot(page, "called-banner");

  // Fe's phone: her side and partner.
  await expect(fe.getByTestId("my-side")).toHaveText("Right side · with Dee", { timeout: 5_000 });
  await shot(fe, "your-turn-side");

  // Team swap: tap Cy, then Dee on the other side.
  const c1 = court(page, "Court 1");
  await c1.getByRole("button", { name: "Cy, Left side. Tap to swap sides" }).click();
  await expect(c1.locator('p[aria-hidden="true"]', { hasText: "Now tap a player on the other side to swap with Cy." })).toBeVisible();
  await c1.getByRole("button", { name: "Dee, Right side. Tap to swap sides" }).click();
  await expect(banner(page)).toHaveText(/Cy and Dee swapped sides\./);
  await expect(onCourt(page, "Court 1")).toHaveText(["Ana", "Dee", "Cy", "Fe"]);
  await shot(page, "team-swap");

  // Who won: one tap on a side; Skip in All off.
  await page.getByRole("button", { name: "Done on Court 1" }).click();
  const picker = c1.getByRole("group", { name: "Who won?" });
  await expect(picker.getByRole("button", { name: /Ana \+ Dee won$/ })).toBeVisible();
  await expect(picker.getByRole("button", { name: /Cy \+ Fe won$/ })).toBeVisible();
  await expect(picker.getByRole("button", { name: "Skip (no winner)" })).toBeVisible();
  await shot(page, "who-won");
  await picker.getByRole("button", { name: /Ana \+ Dee won$/ }).click();
  await expect(banner(page)).toHaveText(/Game #1 on Court 1 is done\. Won: Ana and Dee\./);

  // The organizer changes Bea's level (also on her phone's next check-in).
  await openTab(page, "Queue");
  const sheet = await openPlayer(page, "Bea");
  await sheet.getByRole("button", { name: /^Level/ }).click();
  const sheetPicker = sheet.getByRole("group", { name: "Bea's level" });
  await sheetPicker.getByRole("radio", { name: "Level 4" }).check();
  await shot(page, "level-sheet");
  await sheet.getByRole("button", { name: "Save level" }).click();
  await expect(banner(page)).toHaveText(/Bea is now Level 4\./);
  await expect(queueRows(page).filter({ hasText: "Bea" })).toContainText("Level 4");

  // More: who plays together, while live.
  const more = await openMore(page);
  const presets = more.getByRole("group", { name: "Who plays together" });
  await expect(presets.getByRole("radio", { name: /^Mixed/ })).toBeChecked();
  await expect(presets.getByText(SAME_LEVEL_NOTE)).toBeVisible();
  await presets.getByRole("radio", { name: /^Same level/ }).check();
  await expect(banner(page)).toHaveText(/Who plays together: Same level\. It applies from the next call\./);
  await expect(presets.getByRole("radio", { name: /^Same level/ })).toBeChecked();
  await shot(page, "more-preset");

  await bea.context().close();
  await fe.context().close();
});

test("Same level with no group: the court says so; Call mixed plays queue order once", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize(SIZE);
  await signInWithNewClub(page, "phase9-mixed-call", "Mixed Call Club");
  await newSession(page, "Spread Night", "Same level");
  for (const [name, level] of [["Abe", "Level 1"], ["Ben", "Level 5"], ["Cid", "Level 3"], ["Dan", "Level 2"]] as const) await addWalkIn(page, name, level);
  await openTab(page, "Courts");

  const c1 = court(page, "Court 1");
  await expect(c1.getByText("No level 1 group yet")).toBeVisible();
  await expect(c1.getByRole("button", { name: "Call next 4" })).toHaveCount(0);
  await expect(page.getByText("No level 1 group yet")).toHaveCount(2);
  await shot(page, "no-group");
  await c1.getByRole("button", { name: "Call mixed on Court 1" }).click();
  await expect(banner(page)).toHaveText(/Called to Court 1: Abe, Ben, Cid, Dan · mixed levels · levels 1–5/);
  await expect(onCourt(page, "Court 1")).toHaveText([/Abe|Ben|Cid|Dan/, /Abe|Ben|Cid|Dan/, /Abe|Ben|Cid|Dan/, /Abe|Ben|Cid|Dan/]);
  await shot(page, "call-mixed");
});

test("Settings › club defaults: Same level says courts may wait, in English and Taglish", async ({ page }) => {
  await page.setViewportSize(SIZE);
  await signInWithNewClub(page, "phase9-note", "Note Club");
  await page.goto("/settings/club");
  const presets = page.getByRole("group", { name: "Who plays together" });
  await expect(presets.getByText(SAME_LEVEL_NOTE)).toBeVisible();

  // Taglish on this device (the language cookie, D20; the switch itself is covered in language.spec).
  await page.context().addCookies([{ name: "opq-lang", value: "fil", url: new URL(page.url()).origin }]);
  await page.goto("/settings/club");
  await expect(
    page
      .getByRole("group", { name: "Sino ang magkakasama" })
      .getByText("Puwedeng maghintay ang court hanggang may grupong pareho ang level. Mas bagay ang Halo-halo sa karamihan ng session."),
  ).toBeVisible();
  await shot(page, "same-level-note");
});

test("Keeps queue order: a later arrival in the next group never shows above an earlier player", async ({ page, browser }) => {
  test.setTimeout(90_000);
  await page.setViewportSize(SIZE);
  await signInWithNewClub(page, "phase9-order", "Order Club");
  await newSession(page, "Order Night", "Mixed");
  await page.getByRole("link", { name: "Show QR" }).click();
  const path = new URL((await page.getByText(/\/j\/[A-Z2-9]{6}(?:[A-Z2-9]{2})?$/).textContent())!).pathname;
  await page.goBack();

  // Ana (3), then Bea (5) on her phone, then Cy, Dee (3) and Eli (2). Mixed calls Ana, Cy, Dee, Eli:
  // Bea, 2nd in line, is the one player passed over.
  await addWalkIn(page, "Ana", "Level 3");
  const bea = await phone(browser);
  await bea.goto(path);
  await bea.getByLabel("Name", { exact: true }).fill("Bea");
  await bea.getByRole("radio", { name: "Level 5" }).check();
  await bea.getByRole("button", { name: "Join queue" }).click();
  await expect(bea.getByTestId("position")).toHaveText("2");
  for (const [name, level] of [["Cy", "Level 3"], ["Dee", "Level 3"], ["Eli", "Level 2"]] as const) await addWalkIn(page, name, level);

  // Organizer: true order and real places; Eli (last to arrive) is tagged Next but stays below Bea.
  await openTab(page, "Queue");
  const rows = queueSection(page, "Up next").getByRole("listitem");
  await expect(rows).toHaveText([/^#?1Ana/, /^#?2Bea/, /^#?3Cy/, /^#?4Dee/, /^#?5Eli/]);
  await expect(rows.filter({ has: page.getByTestId("next-tag") })).toHaveText([/Ana/, /Cy/, /Dee/, /Eli/]);
  const beaRow = rows.filter({ hasText: "Bea" });
  await expect(beaRow.getByTestId("next-tag")).toHaveCount(0);
  await expect(beaRow.getByTestId("waiting-for")).toHaveText("Waiting for a level 4–5 group");
  await expect(page.getByTestId("waiting-for")).toHaveCount(1);
  await shot(page, "queue-keep-order");

  // Courts: the Up next summary may list the group the server calls.
  await openTab(page, "Courts");
  await expect(page.getByText("Ana, Cy, Dee, Eli · levels 2–3")).toBeVisible();

  // Bea's phone: her true place and why she waits; nobody listed above her who came later.
  await expect(bea.getByTestId("position")).toHaveText("2");
  await expect(bea.getByTestId("wait-band")).toHaveText("You're 2nd in line. Waiting for a level 4–5 group.", { timeout: 5_000 });
  await expect(bea.getByText("You're in the next group")).toHaveCount(0);
  await expect(bea.getByTestId("ahead")).toHaveText("Ahead of you: Ana");
  await shot(bea, "player-passed-over");
  await bea.getByRole("link", { name: "View courts" }).click();
  const ready = bea.getByRole("region", { name: "Get ready", exact: true }).getByRole("listitem");
  await expect(ready).toHaveText(["#1AnaNext", "#2BeaYou", "#3CyNext", "#4DeeNext", "#5EliNext"]);

  // Taglish on Bea's phone (the per-device language cookie, D20).
  await bea.context().addCookies([{ name: "opq-lang", value: "fil", url: new URL(bea.url()).origin }]);
  await bea.goto(path.replace(/\/?$/, "/me"));
  await expect(bea.getByTestId("wait-band")).toHaveText("Pang-2 ka sa pila. Hinihintay ang grupong level 4–5.");
  await bea.context().close();
});
