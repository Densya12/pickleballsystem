import { expect, test, type Page } from "@playwright/test";
import { signInWithNewClub } from "./support/organizer";

const SESSION_URL = /\/s\/[0-9a-f-]{36}\/live$/;

function upcoming(page: Page) {
  return page.getByRole("region", { name: "Mga susunod na session" });
}

function past(page: Page) {
  return page.getByRole("region", { name: "Nakaraang session" });
}

function liveCard(page: Page) {
  return page.getByRole("region", { name: "LIVE NGAYON" });
}

test.describe("sessions (organizer)", () => {
  test("create and start a session, see it live on Home, end it, find it under Nakaraang session", async ({ page }) => {
    await signInWithNewClub(page, "live", "Makati Picklers");

    // Empty Home
    await expect(liveCard(page)).toHaveCount(0);
    await expect(upcoming(page).getByText("Wala pang naka-schedule.", { exact: false })).toBeVisible();
    await expect(past(page).getByText("Wala pang natapos na session.")).toBeVisible();

    await page.getByRole("link", { name: "Bagong open play" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Bagong open play" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Bumalik" })).toBeVisible();

    // Club defaults are pre-filled (BR2); the courts stepper starts at 2.
    await expect(page.getByRole("radio", { name: "11" })).toBeChecked();
    await expect(page.getByRole("radio", { name: /Lahat ng apat aalis/ })).toBeChecked();
    await expect(page.getByLabel("Bayad bawat player (₱)")).toHaveValue("150");
    await expect(page.getByRole("status").filter({ hasText: "courts" })).toHaveText("2 courts");

    await page.getByLabel("Pangalan ng session").fill("Friday Night Open Play");
    await page.getByLabel("Simula").fill("2026-11-27T18:00");
    await page.getByLabel("Tapos").fill("2026-11-27T21:00");
    await page.getByRole("button", { name: "Dagdag" }).click();
    await page.getByText("15", { exact: true }).click();
    await page.getByText("Mananatili ang nanalo").click();
    await page.getByRole("switch", { name: "Bayad muna bago pumila" }).check();
    await page.getByLabel("Bayad bawat player (₱)").fill("200");
    await page.getByRole("button", { name: "Simulan ang session" }).click();

    // The Live screen, with its 3 courts
    await expect(page).toHaveURL(SESSION_URL);
    const sessionUrl = page.url();
    await expect(page.getByRole("heading", { level: 1, name: "Friday Night Open Play" })).toBeVisible();
    await expect(page.getByText("LIVE", { exact: true })).toBeVisible();
    await expect(page.getByText("6:00 PM – 9:00 PM · 3 courts")).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: /^Court \d$/ })).toHaveCount(3);

    // Home shows it as LIVE NGAYON
    await page.getByRole("link", { name: "Bumalik" }).click();
    await expect(liveCard(page).getByRole("heading", { name: "Friday Night Open Play" })).toBeVisible();
    await expect(liveCard(page).getByText("Biyernes, Nob 27 · 6:00 PM – 9:00 PM · 3 courts")).toBeVisible();
    await liveCard(page).getByRole("link", { name: "Buksan ang session" }).click();
    await expect(page).toHaveURL(sessionUrl);

    // Ending asks first; "Huwag muna" keeps it live
    await page.getByRole("button", { name: "Tapusin ang session" }).click();
    await expect(page.getByText("Sigurado ka? Magsasara ang check-in.")).toBeVisible();
    await page.getByRole("button", { name: "Huwag muna" }).click();
    await expect(page.getByText("LIVE", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Tapusin ang session" }).click();
    await page.getByRole("button", { name: "Oo, tapusin" }).click();
    await expect(page.getByText("Tapos na", { exact: true })).toBeVisible();
    await expect(page.getByText(/Tapos na ang session na ito/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Tapusin ang session" })).toHaveCount(0);
    // The ended page lists the details that were entered.
    await expect(page.getByRole("definition")).toHaveText(["3 courts", "15 points", "Mananatili ang nanalo", "Oo", "₱200", "Wala"]);
    await expect(page.getByText("Biyernes, Nob 27 · 6:00 PM – 9:00 PM", { exact: true })).toBeVisible();

    // Home: no live card; the session is under Nakaraang session
    await page.getByRole("link", { name: "Bumalik" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Nakaraang session" })).toBeVisible();
    await expect(liveCard(page)).toHaveCount(0);
    await expect(past(page).getByRole("link", { name: /Friday Night Open Play/ })).toBeVisible();
    await expect(past(page).getByText("Nob 27, 2026")).toBeVisible();
  });

  test("save a draft, start it from Home, and a second live session is refused (BR1)", async ({ page }) => {
    await signInWithNewClub(page, "draft", "Pasig Dinkers");

    await page.getByRole("link", { name: "Bagong open play" }).click();
    await page.getByLabel("Pangalan ng session").fill("Saturday Smash");
    await page.getByLabel("Simula").fill("2026-11-28T08:00");
    await page.getByLabel("Tapos").fill("2026-11-28T11:00");
    await page.getByRole("button", { name: "I-save muna" }).click();

    // Back on Home, listed under Mga susunod na session
    await expect(page).toHaveURL(/\/$/);
    const row = upcoming(page).getByRole("link", { name: /Saturday Smash/ });
    await expect(row).toBeVisible();
    await expect(row).toContainText("NOB");
    await expect(row).toContainText("28");
    await expect(row).toContainText("8:00 AM – 11:00 AM · 2 courts");
    await expect(liveCard(page)).toHaveCount(0);

    await row.click();
    await expect(page).toHaveURL(SESSION_URL);
    await expect(page.getByText("Draft", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Burahin" })).toBeVisible();
    await page.getByRole("button", { name: "Simulan ang session" }).click();
    await expect(page.getByText("LIVE", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tapusin ang session" })).toBeVisible();

    await page.getByRole("link", { name: "Bumalik" }).click();
    await expect(liveCard(page).getByRole("heading", { name: "Saturday Smash" })).toBeVisible();
    await expect(upcoming(page).getByText("Wala pang naka-schedule.", { exact: false })).toBeVisible();

    // BR1: starting another one while Saturday Smash is live is refused, and the form keeps its input.
    await page.getByRole("link", { name: "Bagong open play" }).click();
    await page.getByLabel("Pangalan ng session").fill("Sunday Social");
    await page.getByLabel("Bayad bawat player (₱)").fill("175");
    await page.getByRole("button", { name: "Simulan ang session" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "May live na session pa" })).toHaveText(
      "May live na session pa. Tapusin muna iyon bago magsimula ng bago.",
    );
    await expect(page.getByLabel("Pangalan ng session")).toHaveValue("Sunday Social");
    await expect(page.getByLabel("Bayad bawat player (₱)")).toHaveValue("175");

    // Saving it as a draft instead works.
    await page.getByRole("button", { name: "I-save muna" }).click();
    await expect(upcoming(page).getByRole("link", { name: /Sunday Social/ })).toBeVisible();
  });

  test("form errors show inline and keep what was typed", async ({ page }) => {
    await signInWithNewClub(page, "errors", "Taguig Smashers");
    await page.getByRole("link", { name: "Bagong open play" }).click();

    await page.getByLabel("Simula").fill("2026-11-27T21:00");
    await page.getByLabel("Tapos").fill("2026-11-27T18:00");
    await page.getByRole("button", { name: "Dagdag" }).click();
    await page.getByLabel("Bayad bawat player (₱)").fill("abc");
    await page.getByRole("button", { name: "I-save muna" }).click();

    await expect(page.getByText("Pakilagay ang pangalan ng session.")).toBeVisible();
    await expect(page.getByText("Dapat mas huli ang Tapos kaysa sa Simula.")).toBeVisible();
    await expect(page.getByText("Buong numero lang, 0 pataas. Hal. 150")).toBeVisible();
    await expect(page.getByLabel("Simula")).toHaveValue("2026-11-27T21:00");
    await expect(page.getByLabel("Tapos")).toHaveValue("2026-11-27T18:00");
    await expect(page.getByLabel("Bayad bawat player (₱)")).toHaveValue("abc");
    await expect(page.getByRole("status").filter({ hasText: "courts" })).toHaveText("3 courts");
    await expect(page).toHaveURL(/\/sessions\/new$/);
  });

  test("a draft can be deleted after confirming", async ({ page }) => {
    await signInWithNewClub(page, "delete", "QC Paddlers");
    await page.getByRole("link", { name: "Bagong open play" }).click();
    await page.getByLabel("Pangalan ng session").fill("Mistake Session");
    await page.getByRole("button", { name: "I-save muna" }).click();

    await upcoming(page).getByRole("link", { name: /Mistake Session/ }).click();
    await page.getByRole("button", { name: "Burahin" }).click();
    await expect(page.getByText("Burahin ang draft na ito?")).toBeVisible();
    await page.getByRole("button", { name: "Oo, burahin" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(upcoming(page).getByText("Wala pang naka-schedule.", { exact: false })).toBeVisible();
  });

  test("staff of another club get not-found for a session", async ({ page, browser }) => {
    await signInWithNewClub(page, "owner", "Alabang Open");
    await page.getByRole("link", { name: "Bagong open play" }).click();
    await page.getByLabel("Pangalan ng session").fill("Private Session");
    await page.getByRole("button", { name: "Simulan ang session" }).click();
    await expect(page).toHaveURL(SESSION_URL);
    const sessionUrl = page.url();

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await signInWithNewClub(otherPage, "other", "Other Club");
    await otherPage.goto(sessionUrl);
    await expect(otherPage.getByRole("heading", { level: 1, name: "Hindi makita ang page na ito" })).toBeVisible();
    await expect(otherPage.getByText("Private Session")).toHaveCount(0);
    await expect(otherPage.getByRole("button", { name: "Tapusin ang session" })).toHaveCount(0);

    // Their own Home doesn't list it either.
    await otherPage.goto("/");
    await expect(liveCard(otherPage)).toHaveCount(0);
    await expect(otherPage.getByText("Private Session")).toHaveCount(0);
    await other.close();
  });
});

test.describe("sessions (signed out)", () => {
  test("session pages redirect to /login", async ({ page }) => {
    await page.goto("/sessions/new");
    await expect(page).toHaveURL(/\/login\?next=%2Fsessions%2Fnew$/);

    await page.goto("/s/00000000-0000-0000-0000-000000000000/live");
    await expect(page).toHaveURL(/\/login\?next=%2Fs%2F00000000-0000-0000-0000-000000000000%2Flive$/);
  });
});
