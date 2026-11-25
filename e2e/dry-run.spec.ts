import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { addMember, addMemberWalkIn, banner, court, endSession, openTab, sessionTabs, SESSION_URL } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

// Phase 7 acceptance: a compressed pilot night. 3 courts (Court 3 singles),
// 18 players (4 phones, 14 walk-ins from members), pay_first, 15+ games, one
// Undo, one swap; then end, the summary, and the CSV.

const MEMBERS = Array.from({ length: 14 }, (_, i) => `Member ${String(i + 1).padStart(2, "0")}`);
const PHONES = ["Pia Phone", "Quin Phone", "Rio Phone", "Sol Phone"];

test("dry run: a full session from members and phones to the summary and CSV", async ({ page: organizer, browser }) => {
  test.setTimeout(300_000);
  await signInWithNewClub(organizer, "dryrun", "Dry Run Club");
  for (const name of MEMBERS) await addMember(organizer, name, { level: "Intermediate" });

  // pay_first, ₱150, 3 courts with Court 3 singles.
  await organizer.goto("/");
  await organizer.getByRole("link", { name: "New session" }).click();
  await organizer.getByLabel("Session name").fill("Pilot Night");
  await organizer.getByRole("button", { name: "More courts" }).click();
  await organizer.getByRole("group", { name: "Court 3" }).getByRole("radio", { name: "Singles" }).check();
  await organizer.getByRole("switch", { name: "Pay before queueing" }).check();
  await organizer.getByRole("button", { name: "Start session" }).click();
  await expect(organizer).toHaveURL(SESSION_URL);
  const courtsUrl = organizer.url();
  await organizer.getByRole("link", { name: "Show QR" }).click();
  const path = new URL((await organizer.getByText(/\/j\/[A-Z2-9]{6}$/).textContent())!).pathname;
  await organizer.goto(courtsUrl);

  // Phones first: 3 GCash (to check counts as paid), 1 cash (held until received).
  const phones = new Map<string, Page>();
  for (const [index, name] of PHONES.entries()) {
    const phone = await (await browser.newContext()).newPage();
    await phone.goto(path);
    await phone.getByLabel("Name", { exact: true }).fill(name);
    if (index < 3) await phone.getByLabel("GCash reference no.").fill(`90000000${index + 10}`);
    else await phone.getByRole("radio", { name: "Cash", exact: true }).check();
    await phone.getByRole("button", { name: "Join queue" }).click();
    await expect(phone.getByRole("heading", { level: 1, name: `Hi, ${name.split(" ")[0]}` })).toBeVisible();
    phones.set(name, phone);
  }
  // 14 regulars, picked from members, paid in cash.
  for (const name of MEMBERS) await addMemberWalkIn(organizer, name);
  // 3 to check + Sol unpaid.
  await expect(sessionTabs(organizer).getByRole("link", { name: "Payments, 4 to act on" })).toBeVisible();

  // Call all three courts.
  await openTab(organizer, "Courts");
  for (const [label, size] of [["Court 1", 4], ["Court 2", 4], ["Court 3", 2]] as const) {
    await court(organizer, label).getByRole("button", { name: `Call next ${size}` }).click();
    await expect(banner(organizer)).toContainText(`Called to ${label}`);
  }

  // Swap: Pia (on Court 1) isn't ready; the organizer replaces her.
  const pia = phones.get("Pia Phone")!;
  await expect(pia.getByRole("alert").filter({ hasText: "You're up" })).toBeVisible({ timeout: 5_000 });
  await pia.getByRole("button", { name: "Not ready yet" }).click();
  await pia.getByRole("button", { name: "Yes, I'm not ready" }).click();
  await court(organizer, "Court 1").getByRole("button", { name: "Pia isn't ready · Swap" }).click();
  await expect(banner(organizer)).toContainText("replaced Pia Phone on Court 1");

  // 16 finishes across the courts, one of them undone: 15 finished games.
  const labels = ["Court 1", "Court 2", "Court 3"];
  let finished = 0;
  for (let i = 0; i < 16; i++) {
    const label = labels[i % 3];
    await organizer.getByRole("button", { name: `Done on ${label}` }).click();
    await expect(banner(organizer)).toContainText(new RegExp(`Game #\\d+ on ${label} is done\\.`));
    finished += 1;
    if (i === 4) {
      await organizer.getByRole("button", { name: /^Undo \(\d+s\)$/ }).click();
      await expect(banner(organizer)).toContainText("is back on");
      finished -= 1;
    }
  }
  expect(finished).toBe(15);

  // End: the summary.
  await endSession(organizer);
  const stats = organizer.locator("dl").first();
  const stat = (label: string) => stats.locator("div").filter({ has: organizer.getByText(label, { exact: true }) }).locator("dd");
  await expect(stat("Players")).toHaveText("18");
  await expect(stat("Courts")).toHaveText("3");
  // 15 finished + the 3 still on court when the session ended.
  await expect(stat("Games")).toHaveText("18");
  const perPlayer = organizer.getByRole("region", { name: "Games per player" }).getByTestId("games-played");
  await expect(perPlayer).toHaveCount(18);
  const counts = (await perPlayer.allTextContents()).map((t) => Number.parseInt(t, 10));
  expect(counts).toEqual([...counts].sort((a, b) => b - a)); // highest first
  // Only finished games count: 10 on Courts 1-2 (4 players each) + 5 singles on Court 3 (2 each).
  expect(counts.reduce((a, b) => a + b, 0)).toBe(10 * 4 + 5 * 2);
  // Sol (cash, never received) was held all night under pay_first, so isn't expected to pay.
  await expect(organizer.getByTestId("summary-payment-counts")).toHaveText("14 paid · 3 to check · 0 unpaid · ₱150 each");
  await expect(organizer.getByText(/^₱2,100\s*of ₱2,550$/)).toBeVisible();

  // CSV: BOM, header, 18 players, totals (in English, the default language).
  const [download] = await Promise.all([
    organizer.waitForEvent("download"),
    organizer.getByRole("link", { name: "Download (Excel)" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^summary-pilot-night-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = await readFile((await download.path())!, "utf8");
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  const lines = csv.slice(1).trimEnd().split("\r\n");
  expect(lines[0]).toBe("Name,Level,Joined by,Games,Payment,Method,Reference,Checked in");
  expect(lines).toHaveLength(20);
  expect(lines[1]).toMatch(/^Pia Phone,Not sure,Phone,\d+,To check,GCash,9000000010,\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  expect(lines.filter((l) => /^Member \d\d,Intermediate,Walk-in,\d+,Paid,Cash,,/.test(l))).toHaveLength(14);
  expect(lines[4]).toMatch(/^Sol Phone,Not sure,Phone,0,Unpaid,Cash,,/);
  // The peso cell has commas, so it is quoted.
  expect(lines[19]).toMatch(/^Total,,18 players,\d+,14 paid · 3 to check · 0 unpaid,"₱2,100 of ₱2,550",,$/);

  // Home: the past session with its players and ₱ collected.
  await organizer.getByRole("link", { name: "Home" }).click();
  const past = organizer.getByRole("region", { name: "Past" });
  await expect(past).toContainText("18 players");
  await expect(past).toContainText("₱2,100");

  for (const phone of phones.values()) await phone.context().close();
});
