import { expect, type Page } from "@playwright/test";

/** Organizer live-session helpers shared by the e2e specs (D19 tabs: Courts · Queue · Payments). */

const UUID = "[0-9a-f-]{36}";
/** Courts tab (the session's main page). */
export const SESSION_URL = new RegExp(`/s/${UUID}$`);
export const QUEUE_URL = new RegExp(`/s/${UUID}/queue$`);
export const PAYMENTS_URL = new RegExp(`/s/${UUID}/payments$`);

export function sessionTabs(page: Page) {
  return page.getByRole("navigation", { name: "Session" });
}

/** Opens a session tab from the tab bar: "Courts", "Queue" or "Payments". */
export async function openTab(page: Page, tab: "Courts" | "Queue" | "Payments") {
  await sessionTabs(page).getByRole("link", { name: new RegExp(`^${tab}`) }).click();
  await expect(page).toHaveURL(tab === "Courts" ? SESSION_URL : tab === "Queue" ? QUEUE_URL : PAYMENTS_URL);
}

/** Opens the More sheet. */
export async function openMore(page: Page) {
  await sessionTabs(page).getByRole("button", { name: "More" }).click();
  return page.getByRole("dialog", { name: "More" });
}

/** More › End session › Yes, end it. Ends on the summary. */
export async function endSession(page: Page) {
  const more = await openMore(page);
  await more.getByRole("button", { name: "End session" }).click();
  await more.getByRole("button", { name: "Yes, end it" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Summary" })).toBeVisible();
}

export async function startSession(
  page: Page,
  name: string,
  /** preset (D25): "Fair line" by default, so the queue specs keep today's order. */
  /** callMode (D26): "Call next automatically" by default, so the queue specs keep today's flow. */
  opts: {
    courts: number;
    winnersStay?: boolean;
    formats?: ("Doubles" | "Singles")[];
    preset?: "Mixed" | "Balanced teams" | "Same level" | "Fair line";
    callMode?: "Wait for me" | "Call next automatically";
  },
) {
  await page.getByRole("link", { name: "New session" }).click();
  await page.getByLabel("Session name").fill(name);
  const step = opts.courts > 2 ? "More courts" : "Fewer courts";
  for (let i = 0; i < Math.abs(opts.courts - 2); i++) await page.getByRole("button", { name: step }).click();
  for (const [index, format] of (opts.formats ?? []).entries()) {
    await page.getByRole("group", { name: `Court ${index + 1}` }).getByRole("radio", { name: format }).check();
  }
  if (opts.winnersStay) await page.getByRole("radio", { name: /^Winners stay/ }).check();
  await page.getByRole("radio", { name: new RegExp(`^${opts.preset ?? "Fair line"}`) }).check();
  await page.getByRole("radio", { name: new RegExp(`^${opts.callMode ?? "Call next automatically"}`) }).check();
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page).toHaveURL(SESSION_URL);
}

export type WalkInPayment = { choice: "Paid cash" | "GCash" | "Pay later"; reference?: string };

/**
 * Adds a walk-in from the header's "+ Walk-in". With a fee there is no default
 * payment choice (D18); specs that don't care get "Pay later". Ends on Queue.
 */
export async function addWalkIn(page: Page, name: string, level = "Not sure", payment?: WalkInPayment) {
  await page.getByRole("link", { name: "Walk-in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Add walk-in" })).toBeVisible();
  await expect(page.getByText("For players without a phone or who can't scan.").filter({ visible: true })).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByRole("radio", { name: level, exact: true }).check();
  const choice = payment?.choice ?? "Pay later";
  const option = page.getByRole("radio", { name: choice, exact: true });
  if (payment || (await option.count()) > 0) {
    await option.check();
    if (payment?.reference) await page.getByLabel("Reference number").fill(payment.reference);
  }
  await page.getByRole("button", { name: "Add to queue" }).click();
  await expect(page).toHaveURL(QUEUE_URL);
  await expect(banner(page)).toContainText(`${name} is in the queue`);
}

/**
 * Done on a court, then "Who won?" (D25): the side whose players are named
 * (e.g. ["Ana", "Ben"]), or Skip when no winners are given.
 */
export async function finishGame(page: Page, label: string, winners?: string[]) {
  await page.getByRole("button", { name: `Done on ${label}` }).click();
  const picker = court(page, label).getByRole("group", { name: "Who won?" });
  if (winners) {
    const names = winners.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(" \\+ ");
    await picker.getByRole("button", { name: new RegExp(`${names} won$`) }).click();
  } else {
    await picker.getByRole("button", { name: "Skip (no winner)" }).click();
  }
}

export function banner(page: Page) {
  return page
    .getByRole("status")
    .filter({ hasText: /Called to|is done\.|is in the queue|is paused|is back in their place|was removed|replaced .* on|is now (singles|doubles)|is back on|play again on|After a game:|swapped sides|is now Level|Who plays together:|Next game:|is back in line|Nasa pila na ulit/ });
}

export function court(page: Page, label: string) {
  return page.getByRole("region", { name: label, exact: true });
}

/** The players on a court (a screen-reader list next to the mini court). */
export function onCourt(page: Page, label: string) {
  return court(page, label).getByRole("list", { name: `Playing on ${label}` }).getByRole("listitem");
}

/** A Queue tab section: "Up next", "After that" or "On hold". */
export function queueSection(page: Page, name: "Up next" | "After that" | "On hold") {
  return page.getByRole("region", { name, exact: true });
}

/** Every waiting row on the Queue tab, in order (Up next, After that, On hold). */
export function queueRows(page: Page) {
  return page.getByRole("main").getByRole("region").getByRole("listitem");
}

/** Taps a name on the Queue tab; returns its action sheet. */
export async function openPlayer(page: Page, name: string) {
  await queueRows(page).getByRole("button", { name: new RegExp(`^(#?\\s*\\d+\\s*)?${name}`) }).click();
  const sheet = page.getByRole("dialog", { name });
  await expect(sheet).toBeVisible();
  return sheet;
}

export function stat(page: Page, label: string) {
  return page.locator("dl > div").filter({ has: page.getByText(label, { exact: true }) }).locator("dd");
}

/** Phase 7: a walk-in picked from the club's members ("From members"). Ends on Queue. */
export async function addMemberWalkIn(page: Page, name: string, payment: WalkInPayment["choice"] = "Paid cash") {
  await page.getByRole("link", { name: "Walk-in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Add walk-in" })).toBeVisible();
  await page.getByLabel("From members").fill(name);
  await page.getByRole("list", { name: "Matching members" }).getByRole("button", { name: new RegExp(`^${name}`) }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(name);
  const option = page.getByRole("radio", { name: payment, exact: true });
  if ((await option.count()) > 0) await option.check();
  await page.getByRole("button", { name: "Add to queue" }).click();
  await expect(page).toHaveURL(QUEUE_URL);
  await expect(banner(page)).toContainText(`${name} is in the queue`);
}

/** Adds a member from /members/new. Ends on the members list. */
export async function addMember(page: Page, name: string, opts: { level?: string; dues?: string; notes?: string } = {}) {
  await page.goto("/members/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  if (opts.level) await page.getByRole("radio", { name: opts.level, exact: true }).check();
  if (opts.dues) await page.getByRole("radio", { name: opts.dues, exact: true }).check();
  if (opts.notes) await page.getByLabel("Notes (optional)").fill(opts.notes);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(`${name} is saved.`)).toBeVisible();
}
