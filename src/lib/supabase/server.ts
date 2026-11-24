import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
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
  const { url, key } = getSupabaseEnv();

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
