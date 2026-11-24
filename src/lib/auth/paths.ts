/** Routes reachable without signing in. Everything else requires an organizer session. */
// /j/<code> is the session check-in link; /c/<code> is the club's permanent QR (Phase 5b).
const PUBLIC_PREFIXES = ["/login", "/auth", "/design-system", "/j", "/c"] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Returns a same-site path to continue to after sign-in, or "/".
 * Rejects absolute URLs and protocol-relative tricks ("//evil.com", "/\evil.com")
 * so `next` can't be used as an open redirect.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/";
  if (/[\u0000-\u001f\u007f]/.test(raw)) return "/";
  if (isPublicPath(raw.split(/[?#]/)[0])) return "/";
  return raw;
}

export function loginPath(next?: string): string {
  const safe = safeNextPath(next);
  return safe === "/" ? "/login" : `/login?next=${encodeURIComponent(safe)}`;
}
