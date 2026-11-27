import { expect, test, type Page } from "@playwright/test";
import { signInWithNewClub } from "./support/organizer";
import { endSession, openMore, SESSION_URL } from "./support/live";

function upcoming(page: Page) {
  return page.getByRole("region", { name: "Upcoming" });
}

function past(page: Page) {
  return page.getByRole("region", { name: "Past" });
}

/** Home's dark live card (D19). */
function liveCard(page: Page) {
  return page.getByRole("link", { name: /^Open / });
}

test.describe("sessions (organizer)", () => {
  test("create and start a session, see it live on Home, end it, find it under Past", async ({ page }) => {
    await signInWithNewClub(page, "live", "Makati Picklers");

    // Empty Home
    await expect(liveCard(page)).toHaveCount(0);
    await expect(upcoming(page).getByText("Nothing scheduled.", { exact: false })).toBeVisible();
    await expect(past(page).getByText("No finished sessions yet.")).toBeVisible();

    await page.getByRole("link", { name: "New session" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "New session" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Home" }).first()).toBeVisible();

    // Club defaults are pre-filled (BR2); the courts stepper starts at 2.
    await expect(page.getByRole("radio", { name: "11" })).toBeChecked();
    await expect(page.getByRole("radio", { name: /^All off/ })).toBeChecked();
    await expect(page.getByLabel("Fee per player (₱)")).toHaveValue("150");
    await expect(page.getByRole("status").filter({ hasText: "courts" })).toHaveText("2 courts");

    await page.getByLabel("Session name").fill("Friday Night Open Play");
    await page.getByLabel("Starts").fill("2026-11-27T18:00");
    await page.getByLabel("Ends").fill("2026-11-27T21:00");
    await page.getByRole("button", { name: "More courts" }).click();
    await page.getByRole("radio", { name: "15" }).check();
    await page.getByRole("radio", { name: /^Winners stay/ }).check();
    await page.getByRole("switch", { name: "Pay before queueing" }).check();
    await page.getByLabel("Fee per player (₱)").fill("200");
    await page.getByRole("button", { name: "Start session" }).click();

    // Courts, with its 3 courts and the session tab bar
    await expect(page).toHaveURL(SESSION_URL);
    const sessionUrl = page.url();
    await expect(page.getByRole("heading", { level: 1, name: "Friday Night Open Play" })).toBeVisible();
    await expect(page.getByText("Live · Winners stay · 0 playing · 0 in queue")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: /^Court \d$/ })).toHaveCount(3);
    await expect(page.getByRole("navigation", { name: "Session" })).toBeVisible();

    // Home shows the live card
    await page.getByRole("link", { name: "Home" }).first().click();
    await expect(liveCard(page)).toHaveAccessibleName("Open Friday Night Open Play");
    await expect(liveCard(page)).toContainText("LIVE");
    await liveCard(page).click();
    await expect(page).toHaveURL(sessionUrl);

    // Ending asks first (More › End session); "Keep going" keeps it live
    const more = await openMore(page);
    await more.getByRole("button", { name: "End session" }).click();
    await expect(more.getByText("End the session? Check-in closes.")).toBeVisible();
    await more.getByRole("button", { name: "Keep going" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByText("Live · Winners stay · 0 playing · 0 in queue")).toBeVisible();

    await endSession(page);
    await expect(page.getByText("Ended", { exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Session" })).toHaveCount(0);
    // The summary lists the details that were entered.
    await expect(page.getByRole("region", { name: "Session details" }).getByRole("definition")).toHaveText([
      "3 courts",
      "Court 1: Doubles · Court 2: Doubles · Court 3: Doubles",
      "15 points",
      "Winners stay",
      // D26: the next game (new clubs default to Wait for me).
      "Wait for me",
      // D25: who plays together (new clubs default to Mixed).
      "Mixed",
      "Yes",
      "₱200",
      "None",
    ]);
    await expect(page.getByText("Friday, Nov 27 · 6:00 PM – 9:00 PM", { exact: true })).toBeVisible();

    // Home: no live card; the session is under Past
    await page.getByRole("link", { name: "Home" }).first().click();
    await expect(page.getByRole("heading", { level: 2, name: "Past" })).toBeVisible();
    await expect(liveCard(page)).toHaveCount(0);
    await expect(past(page).getByRole("link", { name: /Friday Night Open Play/ })).toBeVisible();
    await expect(past(page).getByText("Nov 27 · 0 players")).toBeVisible();
    await expect(past(page).getByText("₱0")).toBeVisible();
  });

  test("save a draft, start it from Home, and a second live session is refused (BR1)", async ({ page }) => {
    await signInWithNewClub(page, "draft", "Pasig Dinkers");

    await page.getByRole("link", { name: "New session" }).click();
    await page.getByLabel("Session name").fill("Saturday Smash");
    await page.getByLabel("Starts").fill("2026-11-28T08:00");
    await page.getByLabel("Ends").fill("2026-11-28T11:00");
    await page.getByRole("button", { name: "Save as draft" }).click();

    // Back on Home, listed under Upcoming
    await expect(page).toHaveURL(/\/$/);
    const row = upcoming(page).getByRole("link", { name: /Saturday Smash/ });
    await expect(row).toBeVisible();
    await expect(row).toContainText("NOV");
    await expect(row).toContainText("28");
    await expect(row).toContainText("8:00 AM – 11:00 AM · 2 courts");
    await expect(liveCard(page)).toHaveCount(0);

    await row.click();
    await expect(page).toHaveURL(SESSION_URL);
    await expect(page.getByText("Draft", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete draft" })).toBeVisible();
    await page.getByRole("button", { name: "Start session" }).click();
    await expect(page.getByText("Live · All off · 0 playing · 0 in queue")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Session" })).toBeVisible();

    await page.getByRole("link", { name: "Home" }).first().click();
    await expect(liveCard(page)).toHaveAccessibleName("Open Saturday Smash");
    await expect(upcoming(page).getByText("Nothing scheduled.", { exact: false })).toBeVisible();

    // BR1: starting another one while Saturday Smash is live is refused, and the form keeps its input.
    await page.getByRole("link", { name: "New session" }).click();
    await page.getByLabel("Session name").fill("Sunday Social");
    await page.getByLabel("Fee per player (₱)").fill("175");
    await page.getByRole("button", { name: "Start session" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Another session is live" })).toHaveText(
      "Another session is live. End it before starting a new one.",
    );
    await expect(page.getByLabel("Session name")).toHaveValue("Sunday Social");
    await expect(page.getByLabel("Fee per player (₱)")).toHaveValue("175");

    // Saving it as a draft instead works.
    await page.getByRole("button", { name: "Save as draft" }).click();
    await expect(upcoming(page).getByRole("link", { name: /Sunday Social/ })).toBeVisible();
  });

  test("form errors show inline and keep what was typed", async ({ page }) => {
    await signInWithNewClub(page, "errors", "Taguig Smashers");
    await page.getByRole("link", { name: "New session" }).click();

    await page.getByLabel("Starts").fill("2026-11-27T21:00");
    await page.getByLabel("Ends").fill("2026-11-27T18:00");
    await page.getByRole("button", { name: "More courts" }).click();
    await page.getByLabel("Fee per player (₱)").fill("abc");
    await page.getByRole("button", { name: "Save as draft" }).click();

    await expect(page.getByText("Enter a session name.")).toBeVisible();
    await expect(page.getByText("The end must be after the start.")).toBeVisible();
    await expect(page.getByText("Whole pesos only, 0 or more. E.g. 150")).toBeVisible();
    await expect(page.getByLabel("Starts")).toHaveValue("2026-11-27T21:00");
    await expect(page.getByLabel("Ends")).toHaveValue("2026-11-27T18:00");
    await expect(page.getByLabel("Fee per player (₱)")).toHaveValue("abc");
    await expect(page.getByRole("status").filter({ hasText: "courts" })).toHaveText("3 courts");
    await expect(page).toHaveURL(/\/sessions\/new$/);
  });

  test("a draft can be deleted after confirming", async ({ page }) => {
    await signInWithNewClub(page, "delete", "QC Paddlers");
    await page.getByRole("link", { name: "New session" }).click();
    await page.getByLabel("Session name").fill("Mistake Session");
    await page.getByRole("button", { name: "Save as draft" }).click();

    await upcoming(page).getByRole("link", { name: /Mistake Session/ }).click();
    await page.getByRole("button", { name: "Delete draft" }).click();
    await expect(page.getByText("Delete this draft?")).toBeVisible();
    await page.getByRole("button", { name: "Yes, delete" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(upcoming(page).getByText("Nothing scheduled.", { exact: false })).toBeVisible();
  });

  test("staff of another club get not-found for a session", async ({ page, browser }) => {
    await signInWithNewClub(page, "owner", "Alabang Open");
    await page.getByRole("link", { name: "New session" }).click();
    await page.getByLabel("Session name").fill("Private Session");
    await page.getByRole("button", { name: "Start session" }).click();
    await expect(page).toHaveURL(SESSION_URL);
    const sessionUrl = page.url();

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await signInWithNewClub(otherPage, "other", "Other Club");
    await otherPage.goto(sessionUrl);
    await expect(otherPage.getByRole("heading", { level: 1, name: "This page can't be found" })).toBeVisible();
    await expect(otherPage.getByText("Private Session")).toHaveCount(0);
    await expect(otherPage.getByRole("navigation", { name: "Session" })).toHaveCount(0);

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

    await page.goto("/s/00000000-0000-0000-0000-000000000000");
    await expect(page).toHaveURL(/\/login\?next=%2Fs%2F00000000-0000-0000-0000-000000000000$/);
  });
});
