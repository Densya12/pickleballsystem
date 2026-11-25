import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import {
  addMember,
  addMemberWalkIn,
  banner,
  court,
  endSession,
  onCourt,
  openMore,
  openPlayer,
  openTab,
  queueSection,
  SESSION_URL,
} from "../../e2e/support/live";
import { signInNewOrganizer, uniqueEmail } from "../../e2e/support/organizer";
import { measure, type ScreenMetrics } from "./metrics";

/**
 * Seeds one realistic club through the real screens, then captures every
 * screen the UI audit covers. Output: docs/ui-audit/after/*.png and
 * docs/ui-audit/after/metrics.json (the "before" run is in docs/ui-audit/screens/).
 * Seed data lives only in the local database.
 */

const OUT = path.resolve(__dirname, "../../docs/ui-audit/after");
const results: ScreenMetrics[] = [];

const PHONE: BrowserContextOptions = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
};

const MEMBERS = [
  "Bong Santos", "Carlo Mendoza", "Dennis Lim", "Edgar Tan", "Fritz Garcia", "Gina Ramos",
  "Hector Cruz", "Ivy Bautista", "Jojo Villanueva", "Karen Aquino", "Leo Navarro", "Mika Torres",
];
const LEVELS = ["Intermediate", "Advanced", "Beginner", "Intermediate"];
const DUES = ["Dues paid", "Dues unpaid", "No dues"];

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  // Let live data and transitions finish.
  await page.waitForTimeout(700);
}

/** Full-page screenshot plus measurements. `also360` adds a 360×800 copy. */
async function shot(page: Page, name: string, screen: string, also360 = false) {
  await settle(page);
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  results.push(await measure(page, screen, file));
  if (also360) {
    const before = page.viewportSize()!;
    await page.setViewportSize({ width: 360, height: 800 });
    await settle(page);
    const small = `${name}-360.png`;
    await page.screenshot({ path: path.join(OUT, small), fullPage: true });
    results.push(await measure(page, `${screen} (360×800)`, small));
    await page.setViewportSize(before);
    await settle(page);
  }
}

async function phone(browser: Browser): Promise<Page> {
  return (await browser.newContext(PHONE)).newPage();
}

async function checkIn(player: Page, joinPath: string, name: string, pay: { reference?: string; cash?: boolean }, level?: string) {
  await player.goto(joinPath);
  await player.getByLabel("Name", { exact: true }).fill(name);
  if (level) await player.getByRole("radio", { name: level, exact: true }).check();
  if (pay.reference) await player.getByLabel("GCash reference no.").fill(pay.reference);
  if (pay.cash) await player.getByRole("radio", { name: "Cash", exact: true }).check();
  await player.getByRole("button", { name: "Join queue" }).click();
  await expect(player.getByRole("heading", { level: 1, name: `Hi, ${name.split(" ")[0]}` })).toBeVisible();
}

async function joinPathOf(organizer: Page, courtsUrl: string): Promise<string> {
  await organizer.getByRole("link", { name: "Show QR" }).click();
  const joinPath = new URL((await organizer.getByText(/\/j\/[A-Z2-9]{6}$/).textContent())!).pathname;
  await organizer.goto(courtsUrl);
  return joinPath;
}

async function confirmCash(organizer: Page, courtsUrl: string, names: string[]) {
  await organizer.goto(`${courtsUrl}/payments`);
  for (const name of names) {
    const row = organizer.getByRole("region", { name: "Unpaid", exact: true }).getByRole("group", { name });
    await row.getByRole("button", { name: `Cash received from ${name}` }).click();
    await expect(organizer.getByRole("status").filter({ hasText: `Got ${name}'s cash.` })).toBeVisible();
  }
  await organizer.goto(courtsUrl);
}

async function newSession(
  organizer: Page,
  name: string,
  opts: { courts: number; singlesCourt3?: boolean; winnersStay?: boolean; payFirst?: boolean; draft?: boolean; start?: string },
) {
  await organizer.goto("/");
  await organizer.getByRole("link", { name: "New session" }).click();
  await organizer.getByLabel("Session name").fill(name);
  if (opts.start) {
    await organizer.getByLabel("Starts").fill(opts.start);
    await organizer.getByLabel("Ends").fill(opts.start.replace(/T(\d\d)/, (_, h) => `T${String(Number(h) + 3).padStart(2, "0")}`));
  }
  const step = opts.courts > 2 ? "More courts" : "Fewer courts";
  for (let i = 0; i < Math.abs(opts.courts - 2); i++) await organizer.getByRole("button", { name: step }).click();
  if (opts.singlesCourt3) await organizer.getByRole("group", { name: "Court 3" }).getByRole("radio", { name: "Singles" }).check();
  if (opts.winnersStay) await organizer.getByRole("radio", { name: /^Winners stay/ }).check();
  if (opts.payFirst) await organizer.getByRole("switch", { name: "Pay before queueing" }).check();
  if (opts.draft) {
    await organizer.getByRole("button", { name: "Save as draft" }).click();
    await expect(organizer.getByRole("heading", { level: 1, name: "Pasig Pickleball Club" })).toBeVisible();
    return "";
  }
  await organizer.getByRole("button", { name: "Start session" }).click();
  await expect(organizer).toHaveURL(SESSION_URL);
  return organizer.url();
}

async function callNext(organizer: Page, label: string) {
  await court(organizer, label).getByRole("button", { name: /^Call next \d$/ }).click();
  await expect(banner(organizer)).toContainText(`Called to ${label}`);
}

test("UI audit: seed a busy club and capture every screen", async ({ page: organizer, browser }) => {
  await mkdir(OUT, { recursive: true });

  // --- Signed out -----------------------------------------------------------
  await organizer.goto("/login");
  await expect(organizer.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible();
  await shot(organizer, "01-login", "Login");

  // --- Owner, club, empty Home ----------------------------------------------
  await signInNewOrganizer(organizer, uniqueEmail("audit-owner"));
  await shot(organizer, "02-club-new", "Club/new (first club)");
  await organizer.getByLabel("Club name").fill("Pasig Pickleball Club");
  await organizer.getByLabel("City (optional)").fill("Pasig");
  await organizer.getByRole("button", { name: "Create club" }).click();
  await expect(organizer.getByRole("heading", { level: 1, name: "Pasig Pickleball Club" })).toBeVisible();
  await shot(organizer, "03-home-empty", "Home (empty club)");

  // GCash (Settings › GCash and fee), a second organizer (invite), 12 members.
  await organizer.goto("/settings/payments");
  await organizer.getByLabel("Name on GCash").fill("Juan Dela Cruz");
  await organizer.getByLabel("GCash number").fill("0917 123 4567");
  await organizer.getByRole("button", { name: "Save" }).click();
  await expect(organizer.getByText("Saved.")).toBeVisible();

  await organizer.goto("/settings/organizers");
  const inviteText = organizer.getByText(/\/invite\/[A-Za-z0-9_-]{43}$/).first();
  await expect(async () => {
    if ((await inviteText.count()) === 0) await organizer.getByRole("button", { name: "Create invite link" }).click();
    await expect(inviteText).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  const inviteUrl = (await inviteText.textContent())!;
  await organizer.goto("/settings/qr");
  const clubQrPath = new URL((await organizer.getByText(/\/c\/[A-Z2-9]{6}$/).textContent())!).pathname;

  const coOrganizer = await (await browser.newContext(PHONE)).newPage();
  await signInNewOrganizer(coOrganizer, uniqueEmail("audit-organizer"));
  await coOrganizer.goto(new URL(inviteUrl).pathname);
  await expect(coOrganizer.getByRole("button", { name: "Join" })).toBeVisible();
  await shot(coOrganizer, "20-invite", "Invite (signed in, before joining)");
  await coOrganizer.getByRole("button", { name: "Join" }).click();
  await expect(coOrganizer.getByRole("heading", { level: 1, name: "Pasig Pickleball Club" })).toBeVisible();
  await coOrganizer.context().close();

  for (const [i, name] of MEMBERS.entries()) {
    await addMember(organizer, name, { level: LEVELS[i % LEVELS.length], dues: DUES[i % 3] });
  }

  // --- Two ended sessions ----------------------------------------------------
  const ana = await phone(browser);
  const thursdayUrl = await newSession(organizer, "Thursday Open Play", { courts: 2 });
  const thursdayJoin = await joinPathOf(organizer, thursdayUrl);
  await checkIn(ana, thursdayJoin, "Ana Lopez", { cash: true }, "Intermediate");
  for (const name of MEMBERS.slice(0, 5)) await addMemberWalkIn(organizer, name);
  await openTab(organizer, "Courts");
  await callNext(organizer, "Court 1");
  await organizer.getByRole("button", { name: "Done on Court 1" }).click();
  await expect(banner(organizer)).toContainText("Game #1 on Court 1 is done");
  await confirmCash(organizer, thursdayUrl, ["Ana Lopez"]);
  await endSession(organizer);

  await newSession(organizer, "Tuesday Open Play", { courts: 1 });
  for (const name of MEMBERS.slice(5, 9)) await addMemberWalkIn(organizer, name);
  await addMemberWalkIn(organizer, "Karen Aquino", "Pay later");
  await openTab(organizer, "Courts");
  await callNext(organizer, "Court 1");
  await organizer.getByRole("button", { name: "Done on Court 1" }).click();
  await expect(banner(organizer)).toContainText("Game #1 on Court 1 is done");
  await organizer.getByRole("button", { name: "Done on Court 1" }).click();
  await expect(banner(organizer)).toContainText("Game #2 on Court 1 is done");
  await endSession(organizer);
  await shot(organizer, "15-buod", "Summary (ended)");

  // Club QR with nothing live.
  const visitor = await phone(browser);
  await visitor.goto(clubQrPath);
  await expect(visitor.getByText("No open play right now.", { exact: false })).toBeVisible();
  await shot(visitor, "28-club-qr-none", "/c/[code] (nothing live)");
  await visitor.context().close();

  // --- A draft, and the new-session form (empty and Repeat last) ---------------
  await newSession(organizer, "Saturday Smash", { courts: 2, draft: true, start: "2026-11-28T08:00" });
  await organizer.goto("/sessions/new");
  await expect(organizer.getByLabel("Session name")).toHaveValue("");
  await shot(organizer, "05-sessions-new", "New session (empty)");
  await organizer.goto("/");
  await organizer.getByRole("link", { name: /^Repeat last:/ }).click();
  await expect(organizer.getByText("Copied from", { exact: false })).toBeVisible();
  await shot(organizer, "06-sessions-new-ulitin", "New session (Repeat last pre-filled)");

  // --- The live session ---------------------------------------------------------
  const courtsUrl = await newSession(organizer, "Friday Night Open Play", { courts: 3, singlesCourt3: true, winnersStay: true, payFirst: true });
  const joinPath = await joinPathOf(organizer, courtsUrl);

  // Phones that will be on court first: Dino and Fe (cash, received).
  const dino = await phone(browser);
  await checkIn(dino, joinPath, "Dino Reyes", { cash: true }, "Advanced");
  const fe = await phone(browser);
  await checkIn(fe, joinPath, "Fe Castillo", { cash: true }, "Beginner");
  await confirmCash(organizer, courtsUrl, ["Dino Reyes", "Fe Castillo"]);
  for (const name of MEMBERS.slice(0, 8)) await addMemberWalkIn(organizer, name);

  // Ana returns ("Join as"), Ben is new: both GCash, to check.
  await ana.goto(joinPath);
  await expect(ana.getByRole("button", { name: "Join as Ana Lopez" })).toBeVisible();
  await shot(ana, "22-checkin-pumila-bilang", "Check-in (returning: Join as)");
  await ana.getByLabel("GCash reference no.").fill("1012 3456 7890");
  await ana.getByRole("button", { name: "Join as Ana Lopez" }).click();
  await expect(ana.getByRole("heading", { level: 1, name: "Hi, Ana" })).toBeVisible();

  const ben = await phone(browser);
  await ben.goto(joinPath);
  await expect(ben.getByRole("button", { name: "Join queue" })).toBeVisible();
  await shot(ben, "21-checkin-first-time", "Check-in (fee, first time)");
  await checkIn(ben, joinPath, "Ben Ocampo", { reference: "2098 7654 3210" }, "Intermediate");

  for (const name of MEMBERS.slice(8, 11)) await addMemberWalkIn(organizer, name);
  await addMemberWalkIn(organizer, "Mika Torres", "Pay later"); // unpaid, held
  const carla = await phone(browser);
  await checkIn(carla, joinPath, "Carla Diaz", { cash: true }); // unpaid, held
  const ella = await phone(browser);
  await checkIn(ella, joinPath, "Ella Marquez", { cash: true }, "Advanced");
  await confirmCash(organizer, courtsUrl, ["Ella Marquez"]);

  // All three courts running.
  for (const label of ["Court 1", "Court 2", "Court 3"]) await callNext(organizer, label);
  await expect(onCourt(organizer, "Court 1")).toHaveText(["Dino Reyes", "Fe Castillo", "Bong Santos", "Carlo Mendoza"]);

  // Fe isn't ready; Ella takes a break.
  await fe.getByRole("button", { name: "Not ready yet" }).click();
  await fe.getByRole("button", { name: "Yes, I'm not ready" }).click();
  await ella.getByRole("button", { name: "Take a break" }).click();
  await expect(ella.getByRole("heading", { level: 1, name: "You're resting" })).toBeVisible();
  await expect(court(organizer, "Court 1").getByRole("button", { name: "Fe isn't ready · Swap" })).toBeVisible({ timeout: 5_000 });

  // --- Organizer screens ------------------------------------------------------------
  await organizer.goto("/");
  await shot(organizer, "04-home-full", "Home (live + drafts + past)");
  await organizer.goto(courtsUrl);
  await shot(organizer, "07-live-busy", "Courts (busy)", true);

  await organizer.getByRole("button", { name: "Done on Court 1" }).click();
  const picker = court(organizer, "Court 1").getByRole("group", { name: "Who won?" });
  await expect(picker).toBeVisible();
  await shot(organizer, "08-live-winner-picker", "Courts (winner picker open)");
  await picker.getByRole("button", { name: "Cancel" }).click();

  await openTab(organizer, "Queue");
  await expect(queueSection(organizer, "On hold").getByRole("button", { name: /Ella Marquez/ })).toContainText("Resting", { timeout: 5_000 });
  await shot(organizer, "29-queue-tab", "Queue (busy)");
  await openPlayer(organizer, "Ana Lopez");
  await shot(organizer, "09-live-player-sheet", "Queue (player sheet open)");
  await organizer.getByRole("dialog").getByRole("button", { name: "Close" }).click();

  // Undo banner: finish the singles court (pick the winner), shoot, then undo.
  await openTab(organizer, "Courts");
  await organizer.getByRole("button", { name: "Done on Court 3" }).click();
  const singlesPicker = court(organizer, "Court 3").getByRole("group", { name: "Who won?" });
  await singlesPicker.getByRole("button").first().click();
  await singlesPicker.getByRole("button", { name: "Confirm" }).click();
  await expect(organizer.getByRole("button", { name: /^Undo \(\d+s\)$/ })).toBeVisible();
  await shot(organizer, "10-live-undo-banner", "Courts (undo banner)");
  await organizer.getByRole("button", { name: /^Undo \(\d+s\)$/ }).click();
  await expect(banner(organizer)).toContainText("is back on");

  // More sheet.
  await openMore(organizer);
  await shot(organizer, "30-more-sheet", "Courts (More sheet open)");
  await organizer.keyboard.press("Escape");

  // Offline with one action waiting (a pause), then back online and undone by hand.
  await openTab(organizer, "Queue");
  await organizer.context().setOffline(true);
  const leo = await openPlayer(organizer, "Leo Navarro");
  await leo.getByRole("button", { name: "Pause" }).click();
  await expect(organizer.getByRole("region", { name: "Waiting for signal" })).toBeVisible();
  await shot(organizer, "11-live-offline-outbox", "Queue (offline, 1 action waiting)");
  await organizer.context().setOffline(false);
  await expect(organizer.getByRole("region", { name: "Waiting for signal" })).toHaveCount(0, { timeout: 15_000 });
  const leoAgain = await openPlayer(organizer, "Leo Navarro");
  await leoAgain.getByRole("button", { name: "Resume" }).click();
  await expect(banner(organizer)).toContainText("Leo Navarro is back in their place");

  await organizer.getByRole("link", { name: "Walk-in" }).click();
  await expect(organizer.getByLabel("From members")).toBeVisible();
  await shot(organizer, "12-walk-in", "Walk-in");
  await organizer.goto(courtsUrl);
  await organizer.getByRole("link", { name: "Show QR" }).click();
  await shot(organizer, "13-session-qr", "Session QR");
  await organizer.goto(`${courtsUrl}/payments`);
  await expect(organizer.getByRole("heading", { level: 1, name: "Payments" })).toBeVisible();
  await shot(organizer, "14-bayad", "Payments", true);

  await organizer.goto("/members");
  await shot(organizer, "16-members", "Members");
  await organizer.getByRole("link", { name: /Bong Santos/ }).click();
  await expect(organizer.getByRole("heading", { level: 1, name: "Edit member" })).toBeVisible();
  await shot(organizer, "17-member-edit", "Member (edit)");
  await organizer.goto("/settings");
  await shot(organizer, "18-settings-owner", "Settings (owner)");
  await organizer.goto("/guide");
  await shot(organizer, "19-guide", "Organizer guide");

  // --- Player phones ------------------------------------------------------------------
  await ana.goto(`${joinPath}/me`);
  await expect(ana.getByTestId("position")).toBeVisible();
  await shot(ana, "23-pwesto-queued", "My place (queued)", true);
  await carla.goto(`${joinPath}/me`);
  await expect(carla.getByText("You'll be skipped until you pay.")).toBeVisible();
  await shot(carla, "24-pwesto-held", "My place (held for payment)");
  await dino.goto(`${joinPath}/me`);
  await expect(dino.getByRole("alert").filter({ hasText: "You're up" })).toBeVisible();
  await shot(dino, "25-pwesto-called", "You're up (called)", true);
  await ella.goto(`${joinPath}/me`);
  await expect(ella.getByRole("heading", { level: 1, name: "You're resting" })).toBeVisible();
  await shot(ella, "26-pwesto-paused", "My place (resting)");
  await ana.getByRole("link", { name: "View courts" }).click();
  await expect(ana.getByRole("heading", { level: 1, name: "Courts" })).toBeVisible();
  await shot(ana, "27-mga-court", "Courts (player)");

  results.sort((a, b) => a.file.localeCompare(b.file));
  await writeFile(path.join(OUT, "metrics.json"), `${JSON.stringify(results, null, 2)}\n`);
  for (const p of [ana, ben, carla, dino, fe, ella]) await p.context().close();
});
