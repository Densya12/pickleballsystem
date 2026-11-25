import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "./database.types";
import { e2eDelay } from "./e2e-delay";
import { getSupabaseEnv } from "./env";

/**
 * Supabase client for Server Components, Server Functions and Route Handlers.
 * Create a new client per request; never share it across requests.
 *
 * Cache Components: this reads cookies (request-time data), so any Server
 * Component that calls it must render inside <Suspense>.
 */
export async function createClient() {
  // Read cookies first: during prerendering this postpones the component
  // before the env check runs, so builds work without env vars.
  const cookieStore = await cookies();
  // Supabase compares token expiry with the current time. Prefetch prerenders
  // (partialPrefetching) can read cookies but not the clock, so wait for the
  // real request; Supabase-backed content is never prerendered.
  await connection();
  const { url, key } = getSupabaseEnv();
  // Only with E2E_ALLOW_DELAY=1 (the skeleton e2e); a no-op everywhere else.
  await e2eDelay(cookieStore.get("e2e_delay_ms")?.value);

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Safe to ignore: src/proxy.ts refreshes the session on each request.
        }
      },
    },
  });
}
