import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { addMember, addMemberWalkIn, banner, court, SESSION_URL } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

// Phase 7 acceptance: a compressed pilot night. 3 courts (Court 3 singles),
// 18 players (4 phones, 14 walk-ins from members), pay_first, 15+ games, one
// Ibalik, one swap; then end, Buod ng session, and the CSV.

const MEMBERS = Array.from({ length: 14 }, (_, i) => `Member ${String(i + 1).padStart(2, "0")}`);
const PHONES = ["Phone Pia", "Phone Quin", "Phone Rio", "Phone Sol"];

test("dry run: a full session from members and phones to the summary and CSV", async ({ page: organizer, browser }) => {
  test.setTimeout(300_000);
  await signInWithNewClub(organizer, "dryrun", "Dry Run Club");
  for (const name of MEMBERS) await addMember(organizer, name, { level: "Intermediate" });

  // pay_first, ₱150, 3 courts with Court 3 singles.
  await organizer.goto("/");
  await organizer.getByRole("link", { name: "Bagong open play" }).click();
  await organizer.getByLabel("Pangalan ng session").fill("Pilot Night");
  await organizer.getByRole("button", { name: "Dagdag" }).click();
  await organizer.getByRole("group", { name: "Court 3" }).getByRole("radio", { name: "Singles" }).check();
  await organizer.getByRole("switch", { name: "Bayad muna bago pumila" }).check();
  await organizer.getByRole("button", { name: "Simulan ang session" }).click();
  await expect(organizer).toHaveURL(SESSION_URL);
  const liveUrl = organizer.url();
  await organizer.getByRole("link", { name: "Ipakita ang QR" }).click();
  const path = new URL((await organizer.getByText(/\/j\/[A-Z2-9]{6}$/).textContent())!).pathname;
  await organizer.goto(liveUrl);

  // Phones first: 3 GCash (pending counts as paid), 1 cash (held until confirmed).
  const phones = new Map<string, Page>();
  for (const [index, name] of PHONES.entries()) {
    const phone = await (await browser.newContext()).newPage();
    await phone.goto(path);
    await phone.getByLabel("Pangalan mo").fill(name);
    if (index < 3) await phone.getByLabel("GCash reference number").fill(`90000000${index + 10}`);
    else await phone.getByRole("switch", { name: "Cash ang ibabayad ko" }).check();
    await phone.getByRole("button", { name: "Pumila na" }).click();
    await expect(phone.getByRole("heading", { level: 1, name: `Hi, ${name}!` })).toBeVisible();
    phones.set(name, phone);
  }
  // 14 regulars, picked from members, paid in cash.
  for (const name of MEMBERS) await addMemberWalkIn(organizer, name);
  await expect(organizer.getByRole("link", { name: /Bayad 14\/18/ })).toBeVisible();

  // Call all three courts.
  for (const label of ["Court 1", "Court 2", "Court 3"]) {
    await court(organizer, label).getByRole("button", { name: "Tawagin ang susunod" }).click();
    await expect(banner(organizer)).toContainText(`Tinawag sa ${label}`);
  }

  // Swap: Pia (on Court 1) isn't ready; the organizer replaces her.
  const pia = phones.get("Phone Pia")!;
  await expect(pia.getByRole("alert").filter({ hasText: "Ikaw na" })).toBeVisible({ timeout: 5_000 });
  await pia.getByRole("button", { name: "Hindi pa ako handa (ibalik sa pila)" }).click();
  await pia.getByRole("button", { name: "Oo, hindi pa ako handa" }).click();
  await court(organizer, "Court 1").getByRole("button", { name: "Palitan" }).click({ timeout: 5_000 });
  await expect(banner(organizer)).toContainText("Pinalitan si Phone Pia");

  // 16 finishes across the courts, one of them undone with Ibalik: 15 finished games.
  const labels = ["Court 1", "Court 2", "Court 3"];
  let finished = 0;
  for (let i = 0; i < 16; i++) {
    const label = labels[i % 3];
    await court(organizer, label).getByRole("button", { name: "Tapos na · tawagin ang susunod" }).click();
    await expect(banner(organizer)).toContainText(new RegExp(`Tapos ang Laro #\\d+ sa ${label}\\.`));
    finished += 1;
    if (i === 4) {
      await organizer.getByRole("button", { name: /^Ibalik \(\d+s\)$/ }).click();
      await expect(banner(organizer)).toContainText("Naibalik ang Laro");
      finished -= 1;
    }
  }
  expect(finished).toBe(15);

  // End: Buod ng session.
  await organizer.getByRole("button", { name: "Tapusin ang session" }).click();
  await organizer.getByRole("button", { name: "Oo, tapusin" }).click();
  await expect(organizer.getByRole("heading", { level: 1, name: "Buod ng session" })).toBeVisible();
  const stats = organizer.locator("dl").first();
  const stat = (label: string) => stats.locator("div").filter({ has: organizer.getByText(label, { exact: true }) }).locator("dd");
  await expect(stat("Players")).toHaveText("18");
  await expect(stat("Courts")).toHaveText("3");
  // 15 finished + the 3 still on court when the session ended.
  await expect(stat("Kabuuang laro")).toHaveText("18");
  const perPlayer = organizer.getByRole("region", { name: "Laro bawat player" }).getByTestId("games-played");
  await expect(perPlayer).toHaveCount(18);
  const counts = (await perPlayer.allTextContents()).map((t) => Number.parseInt(t, 10));
  expect(counts).toEqual([...counts].sort((a, b) => b - a)); // highest first
  // Only finished games count: 10 on Courts 1-2 (4 players each) + 5 singles on Court 3 (2 each).
  expect(counts.reduce((a, b) => a + b, 0)).toBe(10 * 4 + 5 * 2);
  // Sol (cash, never confirmed) was held all night under pay_first, so isn't expected to pay.
  await expect(organizer.getByTestId("summary-payment-counts")).toHaveText("14 bayad · 3 i-check · 0 hindi pa");
  await expect(organizer.getByText(/^₱2,100\s*sa ₱2,550$/)).toBeVisible();

  // CSV: BOM, header, 18 players, totals.
  const [download] = await Promise.all([
    organizer.waitForEvent("download"),
    organizer.getByRole("link", { name: "I-download (Excel)" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^buod-pilot-night-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = await readFile((await download.path())!, "utf8");
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  const lines = csv.slice(1).trimEnd().split("\r\n");
  expect(lines[0]).toBe("Pangalan,Level,Paano pumila,Laro,Bayad,Paraan,Reference,Oras ng check-in");
  expect(lines).toHaveLength(20);
  expect(lines[1]).toMatch(/^Phone Pia,Hindi sigurado,Phone,\d+,I-check,GCash,9000000010,\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  expect(lines.filter((l) => /^Member \d\d,Intermediate,Walk-in,\d+,Bayad na,Cash,,/.test(l))).toHaveLength(14);
  expect(lines[4]).toMatch(/^Phone Sol,Hindi sigurado,Phone,0,Hindi pa bayad,Cash,,/);
  // The peso cell has commas, so it is quoted.
  expect(lines[19]).toMatch(/^Kabuuan,,18 players,\d+,14 bayad · 3 i-check · 0 hindi pa,"₱2,100 sa ₱2,550",,$/);

  // Home: the past session with its players and ₱ collected.
  await organizer.getByRole("link", { name: "Bumalik" }).click();
  await expect(organizer.getByRole("region", { name: "Nakaraang session" })).toContainText("18 players · ₱2,100 nakolekta");

  for (const phone of phones.values()) await phone.context().close();
});
