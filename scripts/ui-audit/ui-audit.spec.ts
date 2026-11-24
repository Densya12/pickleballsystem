import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import { addMember, addMemberWalkIn, banner, court, onCourt, queue, SESSION_URL } from "../../e2e/support/live";
import { signInNewOrganizer, uniqueEmail } from "../../e2e/support/organizer";
import { measure, type ScreenMetrics } from "./metrics";

/**
 * Seeds one realistic club through the real screens, then captures every
 * screen the UI audit covers. Output: docs/ui-audit/screens/*.png and
 * docs/ui-audit/metrics.json. Seed data lives only in the local database.
 */

const OUT = path.resolve(__dirname, "../../docs/ui-audit");
const SCREENS = path.join(OUT, "screens");
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

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  // Let live data and transitions finish.
  await page.waitForTimeout(700);
}

/** Full-page screenshot plus measurements. `also360` adds a 360×800 copy. */
async function shot(page: Page, name: string, screen: string, also360 = false) {
  await settle(page);
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(SCREENS, file), fullPage: true });
  results.push(await measure(page, screen, `screens/${file}`));
  if (also360) {
    const before = page.viewportSize()!;
    await page.setViewportSize({ width: 360, height: 800 });
    await settle(page);
    const small = `${name}-360.png`;
    await page.screenshot({ path: path.join(SCREENS, small), fullPage: true });
    results.push(await measure(page, `${screen} (360×800)`, `screens/${small}`));
    await page.setViewportSize(before);
    await settle(page);
  }
}

async function phone(browser: Browser): Promise<Page> {
  return (await browser.newContext(PHONE)).newPage();
}

async function checkIn(player: Page, joinPath: string, name: string, pay: { reference?: string; cash?: boolean }, level?: string) {
  await player.goto(joinPath);
  await player.getByLabel("Pangalan mo").fill(name);
  if (level) await player.getByRole("radio", { name: level, exact: true }).check();
  if (pay.reference) await player.getByLabel("GCash reference number").fill(pay.reference);
  if (pay.cash) await player.getByRole("switch", { name: "Cash ang ibabayad ko" }).check();
  await player.getByRole("button", { name: "Pumila na" }).click();
  await expect(player.getByRole("heading", { level: 1, name: `Hi, ${name}!` })).toBeVisible();
}

async function joinPathOf(organizer: Page, liveUrl: string): Promise<string> {
  await organizer.getByRole("link", { name: "Ipakita ang QR" }).click();
  const joinPath = new URL((await organizer.getByText(/\/j\/[A-Z2-9]{6}$/).textContent())!).pathname;
  await organizer.goto(liveUrl);
  return joinPath;
}

async function confirmCash(organizer: Page, liveUrl: string, names: string[]) {
  await organizer.goto(liveUrl.replace(/\/live$/, "/payments"));
  for (const name of names) {
    const card = organizer.getByRole("region", { name: /Hindi pa bayad/ }).getByRole("group", { name });
    await card.getByRole("button", { name: "Natanggap na (cash)" }).click();
    await expect(organizer.getByRole("status").filter({ hasText: `Natanggap ang cash ni ${name}` })).toBeVisible();
  }
  await organizer.goto(liveUrl);
}

async function newSession(
  organizer: Page,
  name: string,
  opts: { courts: number; singlesCourt3?: boolean; winnersStay?: boolean; payFirst?: boolean; draft?: boolean; start?: string },
) {
  await organizer.goto("/");
  await organizer.getByRole("link", { name: "Bagong open play" }).click();
  await organizer.getByLabel("Pangalan ng session").fill(name);
  if (opts.start) {
    await organizer.getByLabel("Simula").fill(opts.start);
    await organizer.getByLabel("Tapos").fill(opts.start.replace(/T(\d\d)/, (_, h) => `T${String(Number(h) + 3).padStart(2, "0")}`));
  }
  const step = opts.courts > 2 ? "Dagdag" : "Bawas";
  for (let i = 0; i < Math.abs(opts.courts - 2); i++) await organizer.getByRole("button", { name: step }).click();
  if (opts.singlesCourt3) await organizer.getByRole("group", { name: "Court 3" }).getByRole("radio", { name: "Singles" }).check();
  if (opts.winnersStay) await organizer.getByText("Mananatili ang nanalo").click();
  if (opts.payFirst) await organizer.getByRole("switch", { name: "Bayad muna bago pumila" }).check();
  if (opts.draft) {
    await organizer.getByRole("button", { name: "I-save muna" }).click();
    await expect(organizer.getByRole("heading", { level: 1, name: "Pasig Pickleball Club" })).toBeVisible();
    return "";
  }
  await organizer.getByRole("button", { name: "Simulan ang session" }).click();
  await expect(organizer).toHaveURL(SESSION_URL);
  return organizer.url();
}

async function endSession(organizer: Page) {
  await organizer.getByRole("button", { name: "Tapusin ang session" }).click();
  await organizer.getByRole("button", { name: "Oo, tapusin" }).click();
  await expect(organizer.getByRole("heading", { level: 1, name: "Buod ng session" })).toBeVisible();
}

test("UI audit: seed a busy club and capture every screen", async ({ page: organizer, browser }) => {
  await mkdir(SCREENS, { recursive: true });

  // --- Signed out -----------------------------------------------------------
  await organizer.goto("/login");
  await expect(organizer.getByRole("button", { name: "Ipadala ang login link" })).toBeVisible();
  await shot(organizer, "01-login", "Login");

  // --- Owner, club, empty Home ----------------------------------------------
  await signInNewOrganizer(organizer, uniqueEmail("audit-owner"));
  await shot(organizer, "02-club-new", "Club/new (first club)");
  await organizer.getByLabel("Pangalan ng club").fill("Pasig Pickleball Club");
  await organizer.getByRole("button", { name: "Gawin ang club" }).click();
  await expect(organizer.getByRole("heading", { level: 1, name: "Pasig Pickleball Club" })).toBeVisible();
  await shot(organizer, "03-home-empty", "Home (empty club)");

  // GCash, a second organizer (invite), 12 members.
  await organizer.getByRole("link", { name: "Settings ng club" }).click();
  await expect(organizer.getByRole("heading", { level: 1, name: "Settings ng club" })).toBeVisible();
  // The club/new page stays in the DOM (hidden) with its own "Lungsod" field.
  await organizer.getByLabel("Lungsod (optional)").filter({ visible: true }).fill("Pasig");
  await organizer.getByLabel("Pangalan sa GCash").fill("Juan Dela Cruz");
  await organizer.getByLabel("GCash number").fill("0917 123 4567");
  await organizer.getByRole("button", { name: "I-save" }).click();
  await expect(organizer.getByText("Na-save na.")).toBeVisible();
  // The save refreshes the page; tap again if the first tap landed during that refresh.
  const inviteText = organizer.getByText(/\/invite\/[A-Za-z0-9_-]{43}$/).first();
  await expect(async () => {
    if ((await inviteText.count()) === 0) await organizer.getByRole("button", { name: "Gumawa ng invite link" }).click();
    await expect(inviteText).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  const inviteUrl = (await inviteText.textContent())!;
  const clubQrPath = new URL((await organizer.getByText(/\/c\/[A-Z2-9]{6}$/).textContent())!).pathname;

  const coOrganizer = await (await browser.newContext(PHONE)).newPage();
  await signInNewOrganizer(coOrganizer, uniqueEmail("audit-organizer"));
  await coOrganizer.goto(new URL(inviteUrl).pathname);
  await expect(coOrganizer.getByRole("button", { name: "Sumali" })).toBeVisible();
  await shot(coOrganizer, "20-invite", "Invite (signed in, before joining)");
  await coOrganizer.getByRole("button", { name: "Sumali" }).click();
  await expect(coOrganizer.getByRole("heading", { level: 1, name: "Pasig Pickleball Club" })).toBeVisible();
  await coOrganizer.context().close();

  for (const [i, name] of MEMBERS.entries()) {
    await addMember(organizer, name, { level: LEVELS[i % LEVELS.length], dues: i % 3 === 0 ? "Bayad ang dues" : i % 3 === 1 ? "Hindi pa bayad ang dues" : "Walang dues" });
  }

  // --- Two ended sessions ----------------------------------------------------
  const ana = await phone(browser);
  const thursdayUrl = await newSession(organizer, "Huwebes Open Play", { courts: 2 });
  const thursdayJoin = await joinPathOf(organizer, thursdayUrl);
  await checkIn(ana, thursdayJoin, "Ana Lopez", { cash: true }, "Intermediate");
  for (const name of MEMBERS.slice(0, 5)) await addMemberWalkIn(organizer, name);
  await court(organizer, "Court 1").getByRole("button", { name: "Tawagin ang susunod" }).click();
  await court(organizer, "Court 1").getByRole("button", { name: "Tapos na · tawagin ang susunod" }).click();
  await expect(banner(organizer)).toContainText("Tapos ang Laro #1");
  await confirmCash(organizer, thursdayUrl, ["Ana Lopez"]);
  await endSession(organizer);

  await newSession(organizer, "Martes Open Play", { courts: 1 });
  for (const name of MEMBERS.slice(5, 9)) await addMemberWalkIn(organizer, name);
  await addMemberWalkIn(organizer, "Karen Aquino", "Mamaya na magbabayad");
  await court(organizer, "Court 1").getByRole("button", { name: "Tawagin ang susunod" }).click();
  await court(organizer, "Court 1").getByRole("button", { name: "Tapos na · tawagin ang susunod" }).click();
  await expect(banner(organizer)).toContainText("Tapos ang Laro #1");
  await court(organizer, "Court 1").getByRole("button", { name: "Tapos na · tawagin ang susunod" }).click();
  await expect(banner(organizer)).toContainText("Tapos ang Laro #2");
  await endSession(organizer);
  await shot(organizer, "15-buod", "Buod ng session (ended)");

  // Club QR with nothing live.
  const visitor = await phone(browser);
  await visitor.goto(clubQrPath);
  await expect(visitor.getByText("Wala pang open play ngayon.")).toBeVisible();
  await shot(visitor, "28-club-qr-none", "/c/[code] (nothing live)");
  await visitor.context().close();

  // --- A draft, and the new-session form (empty and Ulitin) -------------------
  await newSession(organizer, "Sabado Smash", { courts: 2, draft: true, start: "2026-11-28T08:00" });
  await organizer.goto("/sessions/new");
  await expect(organizer.getByLabel("Pangalan ng session")).toHaveValue("");
  await shot(organizer, "05-sessions-new", "Bagong open play (empty)");
  await organizer.goto("/");
  await organizer.getByRole("link", { name: /^Ulitin:/ }).click();
  await expect(organizer.getByText("Kinopya mula sa", { exact: false })).toBeVisible();
  await shot(organizer, "06-sessions-new-ulitin", "Bagong open play (Ulitin pre-filled)");

  // --- The live session ---------------------------------------------------------
  const liveUrl = await newSession(organizer, "Biyernes Night Open Play", { courts: 3, singlesCourt3: true, winnersStay: true, payFirst: true });
  const joinPath = await joinPathOf(organizer, liveUrl);

  // Phones that will be on court first: Dino and Fe (cash, confirmed).
  const dino = await phone(browser);
  await checkIn(dino, joinPath, "Dino Reyes", { cash: true }, "Advanced");
  const fe = await phone(browser);
  await checkIn(fe, joinPath, "Fe Castillo", { cash: true }, "Beginner");
  await confirmCash(organizer, liveUrl, ["Dino Reyes", "Fe Castillo"]);
  for (const name of MEMBERS.slice(0, 8)) await addMemberWalkIn(organizer, name);

  // Ana returns ("Pumila bilang"), Ben is new: both GCash, pending.
  await ana.goto(joinPath);
  await expect(ana.getByRole("button", { name: "Pumila bilang Ana Lopez" })).toBeVisible();
  await shot(ana, "22-checkin-pumila-bilang", "Check-in (returning: Pumila bilang)");
  await ana.getByLabel("GCash reference number").fill("1012 3456 7890");
  await ana.getByRole("button", { name: "Pumila bilang Ana Lopez" }).click();
  await expect(ana.getByRole("heading", { level: 1, name: "Hi, Ana Lopez!" })).toBeVisible();

  const ben = await phone(browser);
  await ben.goto(joinPath);
  await expect(ben.getByRole("button", { name: "Pumila na" })).toBeVisible();
  await shot(ben, "21-checkin-first-time", "Check-in (fee, first time)");
  await checkIn(ben, joinPath, "Ben Ocampo", { reference: "2098 7654 3210" }, "Intermediate");

  for (const name of MEMBERS.slice(8, 11)) await addMemberWalkIn(organizer, name);
  await addMemberWalkIn(organizer, "Mika Torres", "Mamaya na magbabayad"); // unpaid, held
  const carla = await phone(browser);
  await checkIn(carla, joinPath, "Carla Diaz", { cash: true }); // unpaid, held
  const ella = await phone(browser);
  await checkIn(ella, joinPath, "Ella Marquez", { cash: true }, "Advanced");
  await confirmCash(organizer, liveUrl, ["Ella Marquez"]);

  // All three courts running.
  for (const label of ["Court 1", "Court 2", "Court 3"]) {
    await court(organizer, label).getByRole("button", { name: "Tawagin ang susunod" }).click();
    await expect(banner(organizer)).toContainText(`Tinawag sa ${label}`);
  }
  await expect(onCourt(organizer, "Court 1")).toHaveText(["Dino Reyes", "Fe Castillo", "Bong Santos", "Carlo Mendoza"]);

  // Fe isn't ready; Ella takes a break.
  await fe.getByRole("button", { name: "Hindi pa ako handa (ibalik sa pila)" }).click();
  await fe.getByRole("button", { name: "Oo, hindi pa ako handa" }).click();
  await ella.getByRole("button", { name: "Pahinga muna" }).click();
  await expect(ella.getByRole("heading", { level: 1, name: "Nagpapahinga ka" })).toBeVisible();
  await expect(court(organizer, "Court 1").getByRole("button", { name: "Palitan" })).toBeVisible({ timeout: 5_000 });
  await expect(queue(organizer).getByRole("button", { name: /Ella Marquez/ })).toContainText("Naka-pause", { timeout: 5_000 });

  // --- Organizer screens ------------------------------------------------------------
  await organizer.goto("/");
  await shot(organizer, "04-home-full", "Home (live + drafts + past)");
  await organizer.goto(liveUrl);
  await shot(organizer, "07-live-busy", "Live (busy)", true);

  await court(organizer, "Court 1").getByRole("button", { name: "Tapos na · tawagin ang susunod" }).click();
  await expect(organizer.getByText("Sino ang nanalo?")).toBeVisible();
  await shot(organizer, "08-live-winner-picker", "Live (winner picker open)");
  await organizer.getByRole("button", { name: "Huwag muna" }).click();

  await queue(organizer).getByRole("button", { name: /Ana Lopez/ }).click();
  await expect(organizer.getByRole("dialog")).toBeVisible();
  await shot(organizer, "09-live-player-sheet", "Live (queue player sheet open)");
  await organizer.getByRole("dialog").getByRole("button", { name: "Isara" }).click();

  // Undo banner: finish the singles court (pick the winner), shoot, then undo.
  await court(organizer, "Court 3").getByRole("button", { name: "Tapos na · tawagin ang susunod" }).click();
  await court(organizer, "Court 3").getByRole("button", { name: "Hector Cruz" }).click();
  await court(organizer, "Court 3").getByRole("button", { name: "Kumpirmahin" }).click();
  await expect(organizer.getByRole("button", { name: /^Ibalik \(\d+s\)$/ })).toBeVisible();
  await shot(organizer, "10-live-undo-banner", "Live (undo banner)");
  await organizer.getByRole("button", { name: /^Ibalik \(\d+s\)$/ }).click();
  await expect(banner(organizer)).toContainText("Naibalik");

  // Offline with one action waiting (a pause), then back online and undone by hand.
  await organizer.context().setOffline(true);
  await queue(organizer).getByRole("button", { name: /Leo Navarro/ }).click();
  await organizer.getByRole("dialog").getByRole("button", { name: "I-pause" }).click();
  await expect(organizer.getByRole("region", { name: "Hinihintay ang signal" })).toBeVisible();
  await shot(organizer, "11-live-offline-outbox", "Live (offline, 1 action waiting)");
  await organizer.context().setOffline(false);
  await expect(organizer.getByRole("region", { name: "Hinihintay ang signal" })).toHaveCount(0, { timeout: 15_000 });
  await queue(organizer).getByRole("button", { name: /Leo Navarro/ }).click();
  await organizer.getByRole("dialog").getByRole("button", { name: "Ituloy" }).click();
  await expect(banner(organizer)).toContainText("Tuloy na si Leo Navarro");

  await organizer.goto(liveUrl);
  await organizer.getByRole("link", { name: "Walk-in" }).click();
  await expect(organizer.getByLabel("Pumili sa members")).toBeVisible();
  await shot(organizer, "12-walk-in", "Walk-in");
  await organizer.goto(liveUrl);
  await organizer.getByRole("link", { name: "Ipakita ang QR" }).click();
  await shot(organizer, "13-session-qr", "Session QR");
  await organizer.goto(liveUrl.replace(/\/live$/, "/payments"));
  await expect(organizer.getByRole("heading", { level: 1, name: "Bayad" })).toBeVisible();
  await shot(organizer, "14-bayad", "Bayad", true);

  await organizer.goto("/members");
  await shot(organizer, "16-members", "Mga member");
  await organizer.getByRole("link", { name: /Bong Santos/ }).click();
  await expect(organizer.getByRole("heading", { level: 1, name: "I-edit ang member" })).toBeVisible();
  await shot(organizer, "17-member-edit", "Member (edit)");
  await organizer.goto("/settings");
  await shot(organizer, "18-settings-owner", "Settings (owner)");
  await organizer.goto("/guide");
  await shot(organizer, "19-guide", "Gabay (guide)");

  // --- Player phones ------------------------------------------------------------------
  await ana.goto(`${joinPath}/me`);
  await expect(ana.getByTestId("position")).toBeVisible();
  await shot(ana, "23-pwesto-queued", "Pwesto (queued)", true);
  await carla.goto(`${joinPath}/me`);
  await expect(carla.getByText("Nilalaktawan ka muna hangga't hindi bayad.")).toBeVisible();
  await shot(carla, "24-pwesto-held", "Pwesto (held for payment)");
  await dino.goto(`${joinPath}/me`);
  await expect(dino.getByRole("alert").filter({ hasText: "Ikaw na" })).toBeVisible();
  await shot(dino, "25-pwesto-called", "Pwesto (called)", true);
  await ella.goto(`${joinPath}/me`);
  await expect(ella.getByRole("heading", { level: 1, name: "Nagpapahinga ka" })).toBeVisible();
  await shot(ella, "26-pwesto-paused", "Pwesto (paused)");
  await ana.getByRole("link", { name: "Tingnan ang mga court" }).click();
  await expect(ana.getByRole("heading", { level: 1, name: "Mga court" })).toBeVisible();
  await shot(ana, "27-mga-court", "Mga court");

  results.sort((a, b) => a.file.localeCompare(b.file));
  await writeFile(path.join(OUT, "metrics.json"), `${JSON.stringify(results, null, 2)}\n`);
  for (const p of [ana, ben, carla, dino, fe, ella]) await p.context().close();
});
