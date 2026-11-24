/**
 * Public origin of the current request. Behind Vercel's proxy the original
 * host arrives in x-forwarded-host (as in the Supabase Next.js auth docs).
 */
export function originFromHeaders(headers: Headers, fallbackUrl?: string): string {
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (host) {
    const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
    const proto = headers.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
    return `${proto}://${host}`;
  }
  return fallbackUrl ? new URL(fallbackUrl).origin : "http://localhost:3000";
}
