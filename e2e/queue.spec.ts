import { expect, test, type Page } from "@playwright/test";
import { signInWithNewClub } from "./support/organizer";

const SESSION_URL = /\/s\/[0-9a-f-]{36}\/live$/;

async function startSession(page: Page, name: string, opts: { courts: number; winnersStay?: boolean }) {
  await page.getByRole("link", { name: "Bagong open play" }).click();
  await page.getByLabel("Pangalan ng session").fill(name);
  const step = opts.courts > 2 ? "Dagdag" : "Bawas";
  for (let i = 0; i < Math.abs(opts.courts - 2); i++) await page.getByRole("button", { name: step }).click();
  if (opts.winnersStay) await page.getByText("Mananatili ang nanalo").click();
  await page.getByRole("button", { name: "Simulan ang session" }).click();
  await expect(page).toHaveURL(SESSION_URL);
}

async function addWalkIn(page: Page, name: string, level = "Hindi sigurado") {
  await page.getByRole("link", { name: "Walk-in" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Magdagdag ng walk-in" })).toBeVisible();
  await expect(page.getByText("Para sa player na walang phone o hindi makapag-scan.")).toBeVisible();
  await page.getByLabel("Pangalan", { exact: true }).fill(name);
  await page.getByRole("radio", { name: level }).check();
  await page.getByRole("button", { name: "Ilagay sa pila" }).click();
  await expect(page).toHaveURL(SESSION_URL);
  await expect(banner(page)).toContainText(`Nasa pila na si ${name}`);
}

function banner(page: Page) {
  return page.getByRole("status").filter({ hasText: /Tinawag|Tapos ang Laro|Nasa pila|Naka-pause|Tuloy na|Inalis/ });
}

function court(page: Page, label: string) {
  return page.getByRole("region", { name: label });
}

function onCourt(page: Page, label: string) {
  return court(page, label).getByRole("list", { name: `Naglalaro sa ${label}` }).getByRole("listitem");
}

function queue(page: Page) {
  return page.getByRole("region", { name: "Susunod sa pila" });
}

function stat(page: Page, label: string) {
  return page.locator("dl > div").filter({ has: page.getByText(label, { exact: true }) }).locator("dd");
}

test.describe("queue engine and Live screen", () => {
  test("all off: 2 courts, 9 walk-ins, call, finish, pause, remove, end", async ({ page }) => {
    await signInWithNewClub(page, "alloff", "Makati Picklers");
    await startSession(page, "All Off Night", { courts: 2 });

    await expect(court(page, "Court 1").getByText("Kailangan pa ng 4 player")).toBeVisible();
    const names = ["Ana", "Ben", "Carlo", "Dina", "Eli", "Fe", "Gil", "Hans", "Ivy"];
    for (const name of names) await addWalkIn(page, name);
    await expect(stat(page, "Nakapila")).toHaveText("9");
    await expect(queue(page).getByRole("listitem").first()).toContainText("1");
    await expect(queue(page).getByRole("listitem").first()).toContainText("Ana");

    // BR7: each court calls the first 4 in queue order
    await court(page, "Court 1").getByRole("button", { name: "Tawagin ang susunod" }).click();
    await expect(banner(page)).toHaveText(/Tinawag sa Court 1: Ana, Ben, Carlo, Dina/);
    await expect(onCourt(page, "Court 1")).toHaveText(["Ana", "Ben", "Carlo", "Dina"]);
    await expect(court(page, "Court 1").getByText("Laro #1")).toBeVisible();
    await court(page, "Court 2").getByRole("button", { name: "Tawagin ang susunod" }).click();
    await expect(banner(page)).toHaveText(/Tinawag sa Court 2: Eli, Fe, Gil, Hans/);
    await expect(stat(page, "Naglalaro")).toHaveText("8");
    await expect(stat(page, "Nakapila")).toHaveText("1");
    await expect(page.getByText("VS", { exact: true })).toHaveCount(0);

    // BR10: all four re-join the end; Court 1 calls Ivy and the first three of them
    await court(page, "Court 1").getByRole("button", { name: "Tapos na · tawagin ang susunod" }).click();
    await expect(banner(page)).toHaveText(/Tapos ang Laro #1 sa Court 1\. Tinawag: Ivy, Ana, Ben, Carlo/);
    await expect(onCourt(page, "Court 1")).toHaveText(["Ivy", "Ana", "Ben", "Carlo"]);
    await expect(queue(page).getByRole("listitem")).toHaveCount(1);
    await expect(queue(page).getByRole("listitem")).toContainText("Dina");

    // BR17: pause Dina from her sheet; she is skipped and keeps her place
    await queue(page).getByRole("button", { name: /Dina/ }).click();
    const sheet = page.getByRole("dialog", { name: "Dina" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "I-pause" }).click();
    await expect(banner(page)).toHaveText(/Naka-pause si Dina/);
    await expect(sheet).toBeHidden();
    await expect(queue(page).getByRole("listitem")).toContainText("Naka-pause");

    await court(page, "Court 2").getByRole("button", { name: "Tapos na · tawagin ang susunod" }).click();
    await expect(banner(page)).toHaveText(/Tapos ang Laro #2 sa Court 2\. Tinawag: Eli, Fe, Gil, Hans/);
    await expect(queue(page).getByRole("listitem").first()).toContainText("Dina");

    // BR18: remove Dina (with a confirm step)
    await queue(page).getByRole("button", { name: /Dina/ }).click();
    await expect(sheet.getByRole("button", { name: "Ituloy" })).toBeVisible();
    await sheet.getByRole("button", { name: "Alisin sa pila" }).click();
    await expect(sheet.getByText("Alisin si Dina sa pila?")).toBeVisible();
    await sheet.getByRole("button", { name: "Oo, alisin" }).click();
    await expect(banner(page)).toHaveText(/Inalis si Dina sa pila\./);
    await expect(queue(page).getByText("Wala pang nakapila.", { exact: false })).toBeVisible();
    await expect(stat(page, "Nakapila")).toHaveText("0");

    // End the session (Phase 2 confirmation kept)
    await page.getByRole("button", { name: "Tapusin ang session" }).click();
    await page.getByRole("button", { name: "Oo, tapusin" }).click();
    await expect(page.getByText("Tapos na", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Court 1" })).toHaveCount(0);
  });

  test("winners stay: pick 2 winners; after 2 wins in a row all four go off", async ({ page }) => {
    await signInWithNewClub(page, "winners", "Pasig Dinkers");
    await startSession(page, "Winners Night", { courts: 1, winnersStay: true });
    for (const name of ["Ana", "Ben", "Carlo", "Dina", "Eli", "Fe"]) await addWalkIn(page, name);

    await court(page, "Court 1").getByRole("button", { name: "Tawagin ang susunod" }).click();
    await expect(onCourt(page, "Court 1")).toHaveText(["Ana", "Ben", "Carlo", "Dina"]);

    // "Tapos na" asks who won first
    await court(page, "Court 1").getByRole("button", { name: "Tapos na · tawagin ang susunod" }).click();
    const picker = court(page, "Court 1").getByRole("group", { name: "Sino ang nanalo?" });
    await expect(picker).toBeVisible();
    await expect(picker.getByRole("button", { name: "Kumpirmahin" })).toBeDisabled();
    await picker.getByRole("button", { name: "Carlo" }).click();
    await picker.getByRole("button", { name: "Ana" }).click();
    await picker.getByRole("button", { name: "Kumpirmahin" }).click();
    await expect(banner(page)).toHaveText(/Tapos ang Laro #1 sa Court 1\. Panalo: Carlo at Ana\. Tinawag: Ana, Carlo, Eli, Fe/);
    await expect(onCourt(page, "Court 1")).toHaveText(["Ana", "Carlo", "Eli", "Fe"]);
    await expect(queue(page).getByRole("listitem")).toHaveText([/Ben/, /Dina/]);

    // Second win in a row: all four go off (winners first) and the next 4 are called
    await court(page, "Court 1").getByRole("button", { name: "Tapos na · tawagin ang susunod" }).click();
    await picker.getByRole("button", { name: "Ana" }).click();
    await picker.getByRole("button", { name: "Carlo" }).click();
    await picker.getByRole("button", { name: "Kumpirmahin" }).click();
    await expect(banner(page)).toHaveText(/Tapos ang Laro #2 sa Court 1\. Panalo: Ana at Carlo\. Tinawag: Ben, Dina, Ana, Carlo/);
    await expect(queue(page).getByRole("listitem")).toHaveText([/Eli/, /Fe/]);

    await page.getByRole("button", { name: "Tapusin ang session" }).click();
    await page.getByRole("button", { name: "Oo, tapusin" }).click();
    await expect(page.getByText("Tapos na", { exact: true })).toBeVisible();
  });

  test("NF9: an action in one browser shows in another within 2 seconds", async ({ page, browser }) => {
    await signInWithNewClub(page, "realtime", "Taguig Smashers");
    await startSession(page, "Realtime Night", { courts: 1 });
    const liveUrl = page.url();

    // A second phone signed in as the same organizer.
    const other = await browser.newContext({ storageState: await page.context().storageState() });
    const second = await other.newPage();
    await second.goto(liveUrl);
    await expect(second.locator('[data-live-sync="connected"]')).toBeVisible();

    await addWalkIn(page, "Rita");
    await expect(queue(second).getByText("Rita")).toBeVisible({ timeout: 2_000 });

    for (const name of ["Sam", "Tess", "Uly"]) await addWalkIn(page, name);
    await expect(queue(second).getByRole("listitem")).toHaveCount(4, { timeout: 2_000 });
    await court(page, "Court 1").getByRole("button", { name: "Tawagin ang susunod" }).click();
    await expect(onCourt(second, "Court 1")).toHaveText(["Rita", "Sam", "Tess", "Uly"], { timeout: 2_000 });
    await expect(stat(second, "Naglalaro")).toHaveText("4", { timeout: 2_000 });

    // Losing the connection shows a notice; back online, it refetches what was missed.
    await other.setOffline(true);
    await expect(second.getByText("Nawalan ng koneksyon.", { exact: false })).toBeVisible();
    await addWalkIn(page, "Vic");
    await other.setOffline(false);
    await expect(queue(second).getByText("Vic")).toBeVisible({ timeout: 15_000 });
    await expect(second.getByText("Nawalan ng koneksyon.", { exact: false })).toBeHidden();
    await other.close();
  });

  test("QR page and the public /j link", async ({ page, browser }) => {
    await signInWithNewClub(page, "qr", "QC Paddlers");
    await startSession(page, "QR Night", { courts: 1 });
    await page.getByRole("link", { name: "Ipakita ang QR" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "QR Night" })).toBeVisible();
    await expect(page.getByText("I-scan para pumila")).toBeVisible();
    await expect(page.getByRole("img", { name: /QR code/ }).locator("svg")).toBeVisible();
    for (const step of ["Buksan ang camera ng phone.", "Itapat sa QR code.", "Pindutin ang link na lalabas. Walang app na kailangan."]) {
      await expect(page.getByText(step)).toBeVisible();
    }
    await expect(page.getByText("O pumunta sa:")).toBeVisible();
    const link = await page.getByText(/\/j\/[A-Z2-9]{6}$/).textContent();
    const code = link!.slice(-6);
    await expect(page.getByText(code, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "I-share sa Messenger" })).toBeVisible();
    await expect(page.getByRole("button", { name: "I-print ang QR" })).toBeVisible();

    // The QR link is public: a signed-out phone sees the placeholder while live...
    const player = await (await browser.newContext()).newPage();
    await player.goto(`/j/${code}`);
    await expect(player.getByText("Malapit na ang check-in.", { exact: false })).toBeVisible();
    await player.goto("/j/ZZZZZZ");
    await expect(player.getByText("Sarado na ang check-in.", { exact: false })).toBeVisible();

    // ...and "closed" once the session ends.
    await page.getByRole("link", { name: "Bumalik" }).click();
    await page.getByRole("button", { name: "Tapusin ang session" }).click();
    await page.getByRole("button", { name: "Oo, tapusin" }).click();
    await expect(page.getByText("Tapos na", { exact: true })).toBeVisible();
    await player.goto(`/j/${code.toLowerCase()}`);
    await expect(player.getByText("Sarado na ang check-in.", { exact: false })).toBeVisible();
  });
});
