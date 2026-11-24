export type SupabaseEnv = { url: string; key: string };

/**
 * Reads the public Supabase config, or null when it isn't set.
 *
 * `process.env.NEXT_PUBLIC_*` must be referenced literally so Next.js can
 * inline the values into the browser bundle. Supabase now calls the public key
 * the "publishable" key; the older "anon" key name is still accepted.
 *
 * `||` (not `??`) so an empty PUBLISHABLE_KEY (e.g. a blank Vercel var) still
 * falls back to ANON_KEY.
 */
export function readSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

export function getSupabaseEnv(): SupabaseEnv {
  const env = readSupabaseEnv();
  if (!env) {
    throw new Error(
      "Missing Supabase env vars. Copy .env.example to .env.local and set " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return env;
}
