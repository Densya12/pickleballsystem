import "server-only";
import { cache } from "react";

/**
 * Test hook for the skeleton e2e (slow data on a fast network): when the
 * server runs with E2E_ALLOW_DELAY=1 and the request has an `e2e_delay_ms`
 * cookie, server data waits that long once per request. Without the env var
 * (every real deployment) it does nothing.
 */
const MAX_DELAY_MS = 5_000;

export const e2eDelay = cache(async (cookieValue: string | undefined): Promise<void> => {
  if (process.env.E2E_ALLOW_DELAY !== "1" || !cookieValue) return;
  const ms = Math.min(Number.parseInt(cookieValue, 10) || 0, MAX_DELAY_MS);
  if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
});
