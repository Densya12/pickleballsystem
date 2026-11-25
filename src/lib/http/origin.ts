type Env = Record<string, string | undefined>;

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/** "Example.com:443/", "https://example.com" → "example.com:443" / "example.com". */
function hostOf(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  try {
    return new URL(v.includes("://") ? v : `https://${v}`).host || null;
  } catch {
    return null;
  }
}

/**
 * Hosts the app may build links and redirects for (QA-08): ALLOWED_HOSTS
 * (comma-separated, e.g. a custom domain), the site URL, Vercel's own
 * deployment, branch and production hosts, and localhost on any port.
 */
export function allowedHosts(env: Env = process.env): Set<string> {
  const hosts = new Set<string>();
  const add = (v: string | undefined) => {
    const h = v ? hostOf(v) : null;
    if (h) hosts.add(h);
  };
  for (const h of (env.ALLOWED_HOSTS ?? "").split(",")) add(h);
  add(env.NEXT_PUBLIC_SITE_URL);
  add(env.VERCEL_URL);
  add(env.VERCEL_BRANCH_URL);
  add(env.VERCEL_PROJECT_PRODUCTION_URL);
  return hosts;
}

function isAllowed(host: string, env: Env): boolean {
  return LOCAL_HOST.test(host) || allowedHosts(env).has(host);
}

/** Where to send people when the request's host isn't on the list. */
function configuredOrigin(env: Env): string | null {
  const site = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) {
    try {
      return new URL(site).origin;
    } catch {
      // fall through to Vercel's hosts
    }
  }
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL;
  const host = vercel ? hostOf(vercel) : null;
  return host ? `https://${host}` : null;
}

/**
 * Public origin of the current request, for auth redirects, QR links and
 * invite links. Behind Vercel's proxy the original host arrives in
 * x-forwarded-host (as in the Supabase Next.js auth docs), but a header is
 * only trusted when its host is on the allowlist (QA-08); anything else falls
 * back to NEXT_PUBLIC_SITE_URL, then Vercel's production/deployment host.
 */
export function originFromHeaders(headers: Headers, fallbackUrl?: string, env: Env = process.env): string {
  const raw = headers.get("x-forwarded-host") ?? headers.get("host");
  // A proxy chain may send "a, b": the first is the client-facing host.
  const host = raw ? hostOf(raw.split(",")[0]) : null;
  if (host && isAllowed(host, env)) {
    const forwarded = headers.get("x-forwarded-proto")?.split(",")[0].trim().toLowerCase();
    const proto =
      forwarded === "http" || forwarded === "https" ? forwarded : LOCAL_HOST.test(host) ? "http" : "https";
    return `${proto}://${host}`;
  }
  const configured = configuredOrigin(env);
  if (configured) return configured;
  if (fallbackUrl) {
    const fallback = new URL(fallbackUrl);
    if (isAllowed(fallback.host, env)) return fallback.origin;
  }
  return "http://localhost:3000";
}
