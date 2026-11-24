import { defineConfig } from "@playwright/test";

/**
 * UI audit: seeds a realistic club through the app's own screens (local
 * Supabase stack, magic links from Mailpit) and saves full-page screenshots
 * and measurements to docs/ui-audit/. Not part of `npm run test:e2e`.
 *
 *   npx supabase start
 *   PORT=3100 npx playwright test -c scripts/ui-audit/playwright.config.ts
 */
const PORT = Number(process.env.PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: ".",
  testMatch: "ui-audit.spec.ts",
  workers: 1,
  reporter: "list",
  timeout: 900_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  },
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    cwd: "../..",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 240_000,
  },
});
