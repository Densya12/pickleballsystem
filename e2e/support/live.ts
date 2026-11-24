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

export async function addWalkIn(page: Page, name: string, level = "Hindi sigurado") {
  await page.getByRole("link", { name: "Walk-in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Magdagdag ng walk-in" })).toBeVisible();
  await expect(page.getByText("Para sa player na walang phone o hindi makapag-scan.")).toBeVisible();
  await page.getByLabel("Pangalan", { exact: true }).fill(name);
  await page.getByRole("radio", { name: level }).check();
  await page.getByRole("button", { name: "Ilagay sa pila" }).click();
  await expect(page).toHaveURL(SESSION_URL);
  await expect(banner(page)).toContainText(`Nasa pila na si ${name}`);
}

export function banner(page: Page) {
  return page.getByRole("status").filter({ hasText: /Tinawag|Tapos ang Laro|Nasa pila|Naka-pause|Tuloy na|Inalis|Pinalitan|(Singles|Doubles) na ang/ });
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
