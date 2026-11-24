import { expect, type Page } from "@playwright/test";

/** Organizer Live-screen helpers shared by the queue and player e2e specs. */

export const SESSION_URL = /\/s\/[0-9a-f-]{36}\/live$/;

export async function startSession(
  page: Page,
  name: string,
  opts: { courts: number; winnersStay?: boolean; formats?: ("Doubles" | "Singles")[] },
) {
  await page.getByRole("link", { name: "Bagong open play" }).click();
  await page.getByLabel("Pangalan ng session").fill(name);
  const step = opts.courts > 2 ? "Dagdag" : "Bawas";
  for (let i = 0; i < Math.abs(opts.courts - 2); i++) await page.getByRole("button", { name: step }).click();
  for (const [index, format] of (opts.formats ?? []).entries()) {
    await page.getByRole("group", { name: `Court ${index + 1}` }).getByRole("radio", { name: format }).check();
  }
  if (opts.winnersStay) await page.getByText("Mananatili ang nanalo").click();
  await page.getByRole("button", { name: "Simulan ang session" }).click();
  await expect(page).toHaveURL(SESSION_URL);
}

export type WalkInPayment = { choice: "Nagbayad ng cash" | "GCash" | "Mamaya na magbabayad"; reference?: string };

/**
 * With a fee there is no default payment choice (D18); specs that don't care
 * how a walk-in pays get "Mamaya na magbabayad".
 */
export async function addWalkIn(page: Page, name: string, level = "Hindi sigurado", payment?: WalkInPayment) {
  await page.getByRole("link", { name: "Walk-in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Magdagdag ng walk-in" })).toBeVisible();
  await expect(page.getByText("Para sa player na walang phone o hindi makapag-scan.")).toBeVisible();
  await page.getByLabel("Pangalan", { exact: true }).fill(name);
  await page.getByRole("radio", { name: level }).check();
  const choice = payment?.choice ?? "Mamaya na magbabayad";
  const option = page.getByRole("radio", { name: choice });
  if (payment || (await option.count()) > 0) {
    await option.check();
    if (payment?.reference) await page.getByLabel("GCash reference number (kung GCash)").fill(payment.reference);
  }
  await page.getByRole("button", { name: "Ilagay sa pila" }).click();
  await expect(page).toHaveURL(SESSION_URL);
  await expect(banner(page)).toContainText(`Nasa pila na si ${name}`);
}

export function banner(page: Page) {
  return page.getByRole("status").filter({ hasText: /Tinawag|Tapos ang Laro|Nasa pila|Naka-pause|Tuloy na|Inalis|Pinalitan|(Singles|Doubles) na ang|Naibalik/ });
}

export function court(page: Page, label: string) {
  return page.getByRole("region", { name: label });
}

export function onCourt(page: Page, label: string) {
  return court(page, label).getByRole("list", { name: `Naglalaro sa ${label}` }).getByRole("listitem");
}

export function queue(page: Page) {
  return page.getByRole("region", { name: "Susunod sa pila" });
}

export function stat(page: Page, label: string) {
  return page.locator("dl > div").filter({ has: page.getByText(label, { exact: true }) }).locator("dd");
}

/** Phase 7: a walk-in picked from the club's members ("Pumili sa members"). */
export async function addMemberWalkIn(page: Page, name: string, payment: WalkInPayment["choice"] = "Nagbayad ng cash") {
  await page.getByRole("link", { name: "Walk-in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Magdagdag ng walk-in" })).toBeVisible();
  await page.getByLabel("Pumili sa members").fill(name);
  await page.getByRole("list", { name: "Mga member na tugma" }).getByRole("button", { name: new RegExp(`^${name}`) }).click();
  await expect(page.getByLabel("Pangalan", { exact: true })).toHaveValue(name);
  const option = page.getByRole("radio", { name: payment });
  if ((await option.count()) > 0) await option.check();
  await page.getByRole("button", { name: "Ilagay sa pila" }).click();
  await expect(page).toHaveURL(SESSION_URL);
  await expect(banner(page)).toContainText(`Nasa pila na si ${name}`);
}

/** Adds a member from /members/new. Ends on the members list. */
export async function addMember(page: Page, name: string, opts: { level?: string; dues?: string; notes?: string } = {}) {
  await page.goto("/members/new");
  await page.getByLabel("Pangalan", { exact: true }).fill(name);
  if (opts.level) await page.getByRole("radio", { name: opts.level, exact: true }).check();
  if (opts.dues) await page.getByRole("radio", { name: opts.dues, exact: true }).check();
  if (opts.notes) await page.getByLabel("Notes (optional)").fill(opts.notes);
  await page.getByRole("button", { name: "I-save" }).click();
  await expect(page.getByText(`Na-save si ${name}.`)).toBeVisible();
}
