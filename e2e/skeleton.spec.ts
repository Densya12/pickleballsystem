import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { addWalkIn, court, endSession, PAYMENTS_URL, QUEUE_URL, SESSION_URL, startSession } from "./support/live";
import { signInWithNewClub } from "./support/organizer";

/*
 * Skeleton loading (first loads). The server's data is slowed per request with
 * the e2e_delay_ms cookie (honoured only when the server runs with
 * E2E_ALLOW_DELAY=1, see playwright.config.ts), so the shell streams first and
 * the data part shows its skeleton, as on a slow connection.
 */

const DELAY_MS = 1_000;

async function setDelay(context: BrowserContext, page: Page, ms: number) {
  const url = new URL(page.url() === "about:blank" ? (test.info().project.use.baseURL as string) : page.url());
  if (ms > 0) await context.addCookies([{ name: "e2e_delay_ms", value: String(ms), domain: url.hostname, path: "/" }]);
  else await context.clearCookies({ name: "e2e_delay_ms" });
}

/**
 * Records, every frame, whether a skeleton block was visible (opacity > 0, so
 * after its 150 ms appear delay), and the Cumulative Layout Shift.
 */
async function watch(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __skeletonSeen: boolean; __cls: number };
    w.__skeletonSeen = false;
    w.__cls = 0;
    const tick = () => {
      for (const el of document.querySelectorAll(".skeleton")) {
        if (Number.parseFloat(getComputedStyle(el).opacity) > 0.05) w.__skeletonSeen = true;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
        if (!entry.hadRecentInput) w.__cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

type Box = { top: number; height: number };
const boxes = (page: Page, selector: string): Promise<Box[]> =>
  page.locator(selector).evaluateAll((els) =>
    els
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top + window.scrollY), height: Math.round(r.height) };
      }),
  );
/** Where the skeleton drew a block, the content lands within 4 px (top and height). */
function expectSameBoxes(skeleton: Box[], content: Box[], what: string): number {
  expect(content.length, what).toBe(skeleton.length);
  let worst = 0;
  for (const [i, box] of skeleton.entries()) {
    expect(Math.abs(content[i].top - box.top), `${what} #${i + 1} top`).toBeLessThanOrEqual(4);
    expect(Math.abs(content[i].height - box.height), `${what} #${i + 1} height`).toBeLessThanOrEqual(4);
    worst = Math.max(worst, Math.abs(content[i].top - box.top), Math.abs(content[i].height - box.height));
  }
  return worst;
}

const seen = (page: Page) => page.evaluate(() => (window as unknown as { __skeletonSeen: boolean }).__skeletonSeen);
const resetSeen = (page: Page) => page.evaluate(() => ((window as unknown as { __skeletonSeen: boolean }).__skeletonSeen = false));
const cls = (page: Page) => page.evaluate(() => (window as unknown as { __cls: number }).__cls);

/** The loading region is shown (aria-busy, visible blocks), then replaced by content. */
async function expectSkeletonThenContent(page: Page, content: () => Promise<void>, measure?: () => Promise<void>) {
  const region = page.locator('[aria-busy="true"][data-skeleton]').filter({ visible: true });
  await expect(region).toHaveCount(1);
  await expect(region.getByText(/Loading…/)).toHaveClass(/sr-only/);
  await expect.poll(() => seen(page)).toBe(true);
  await measure?.();
  await content();
  await expect(page.locator('[aria-busy="true"][data-skeleton]').filter({ visible: true })).toHaveCount(0);
}

/** One club: 2 past sessions, 1 draft, 1 live (3 courts) with 6 walk-ins, so the real screens match their skeletons. */
async function seedClub(page: Page) {
  await signInWithNewClub(page, "skeleton", "Skeleton Club");
  for (const name of ["Past One", "Past Two"]) {
    await startSession(page, name, { courts: 1 });
    await endSession(page);
    await page.goto("/");
  }
  await page.getByRole("link", { name: "New session" }).click();
  await page.getByLabel("Session name").fill("Next Week");
  await page.getByRole("button", { name: "Save as draft" }).click();
  await expect(page.getByRole("region", { name: "Upcoming" }).getByRole("link", { name: /Next Week/ })).toBeVisible();
  await startSession(page, "Skeleton Night", { courts: 3 });
  const courtsUrl = page.url();
  for (const name of ["Ana", "Ben", "Carlo", "Dina", "Eli", "Fe"]) await addWalkIn(page, name);
  await page.goto(courtsUrl);
  await court(page, "Court 1").getByRole("button", { name: "Call next 4" }).click();
  await expect(page.getByText("Live · 4 playing · 2 in queue")).toBeVisible();
  return courtsUrl;
}

test.describe("skeleton loading", () => {
  test("throttled: Courts, Queue, Payments, Home and My place show skeletons, then content; CLS on Courts and Home", async ({ page, context, browser }, testInfo) => {
    test.setTimeout(120_000);
    const courtsUrl = await seedClub(page);
    await page.getByRole("link", { name: "Show QR" }).click();
    const joinPath = new URL((await page.getByText(/\/j\/[A-Z2-9]{6}$/).textContent())!).pathname;

    await watch(page);
    await setDelay(context, page, DELAY_MS);

    // Courts (a first load): the shell is real, the courts are skeletons.
    // waitUntil "commit": with streaming, "load" only fires once the data is in.
    await page.goto(courtsUrl, { waitUntil: "commit" });
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Session" }).getByRole("link", { name: "Courts" })).toBeVisible();
    let skeletonCourts: Box[] = [];
    await expectSkeletonThenContent(
      page,
      async () => {
        await expect(page.getByRole("heading", { level: 1, name: "Skeleton Night" })).toBeVisible({ timeout: 10_000 });
        await expect(page.getByRole("heading", { level: 2, name: /^Court \d$/ })).toHaveCount(3);
      },
      async () => {
        skeletonCourts = await boxes(page, "[data-skeleton] .skeleton-card");
      },
    );
    const courtsOffset = expectSameBoxes(skeletonCourts, await boxes(page, 'main section[aria-labelledby^="court-"]'), "court card");
    await page.waitForTimeout(500);
    const courtsCls = await cls(page);

    // Queue and Payments, first loads. (Opened from the tab bar they are often
    // prefetched already, and then show their content at once, with no skeleton.)
    await page.goto(`${courtsUrl}/queue`, { waitUntil: "commit" });
    await expect(page).toHaveURL(QUEUE_URL);
    await expectSkeletonThenContent(page, async () => {
      await expect(page.getByRole("region", { name: "Up next", exact: true }).getByRole("listitem")).toHaveCount(2, { timeout: 10_000 });
    });
    await page.goto(`${courtsUrl}/payments`, { waitUntil: "commit" });
    await expect(page).toHaveURL(PAYMENTS_URL);
    await expectSkeletonThenContent(page, async () => {
      await expect(page.getByTestId("payment-counts")).toBeVisible({ timeout: 10_000 });
    });

    // Home (a first load).
    const home = await context.newPage();
    await watch(home);
    await home.goto("/", { waitUntil: "commit" });
    let skeletonHome: Box[] = [];
    await expectSkeletonThenContent(
      home,
      async () => {
        await expect(home.getByRole("heading", { level: 1, name: "Skeleton Club" })).toBeVisible({ timeout: 10_000 });
        await expect(home.getByRole("link", { name: "Open Skeleton Night" })).toBeVisible();
      },
      async () => {
        // The live card, the quick actions, the Upcoming and Past groups.
        skeletonHome = await boxes(home, "[data-skeleton] .skeleton-dark, [data-skeleton] .flex.gap-2\\.5, [data-skeleton] ul");
      },
    );
    const homeOffset = expectSameBoxes(skeletonHome, await boxes(home, 'main a[aria-label^="Open "], main .flex.gap-2\\.5, main ul'), "Home block");
    await home.waitForTimeout(500);
    const homeCls = await cls(home);

    // Player: My place (in line).
    const playerContext = await browser.newContext();
    const player = await playerContext.newPage();
    await player.goto(joinPath);
    await player.getByLabel("Name", { exact: true }).fill("Pia Cruz");
    await player.getByRole("radio", { name: "Cash", exact: true }).check();
    await player.getByRole("button", { name: "Join queue" }).click();
    await expect(player.getByTestId("position")).toBeVisible();
    await watch(player);
    await setDelay(playerContext, player, DELAY_MS);
    await player.reload({ waitUntil: "commit" });
    await expectSkeletonThenContent(player, async () => {
      await expect(player.getByTestId("position")).toHaveText("3", { timeout: 10_000 });
    });
    await playerContext.close();

    const report =
      `CLS (1 s data delay): Courts ${courtsCls.toFixed(4)}, Home ${homeCls.toFixed(4)}; ` +
      `largest skeleton→content offset: Courts ${courtsOffset}px, Home ${homeOffset}px`;
    console.log(report);
    testInfo.annotations.push({ type: "CLS", description: report });
    expect(courtsCls).toBeLessThan(0.1);
    expect(homeCls).toBeLessThan(0.1);
  });

  test("no delay: the skeleton never appears; a Realtime update on Courts keeps the content", async ({ page, context, browser }) => {
    test.setTimeout(120_000);
    const courtsUrl = await seedClub(page);

    await watch(page);
    await page.goto(courtsUrl);
    await expect(page.getByRole("heading", { level: 2, name: /^Court \d$/ })).toHaveCount(3);
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Open Skeleton Night" })).toBeVisible();
    await page.waitForTimeout(400);
    expect(await seen(page)).toBe(false);

    // Courts with slow data: a change from another phone refetches in place, without a skeleton.
    await page.goto(courtsUrl);
    await expect(page.locator('[data-live-sync="connected"]')).toBeVisible();
    await setDelay(context, page, DELAY_MS);
    await page.waitForTimeout(1_500); // the refetch on join (also slow) settles
    await resetSeen(page);

    const other = await browser.newContext({ storageState: await context.storageState() });
    await other.clearCookies({ name: "e2e_delay_ms" });
    const second = await other.newPage();
    await second.goto(courtsUrl);
    await addWalkIn(second, "Gil");

    await expect(page.getByText("Live · 4 playing · 3 in queue")).toBeVisible({ timeout: 10_000 });
    expect(await seen(page)).toBe(false);
    await expect(page.locator('[aria-busy="true"][data-skeleton]')).toHaveCount(0);
    await expect(page).toHaveURL(SESSION_URL);
    await other.close();
  });
});
