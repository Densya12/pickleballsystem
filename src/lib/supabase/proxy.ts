import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath, loginPath, safeNextPath } from "@/lib/auth/paths";
import type { Database } from "./database.types";
import { readSupabaseEnv } from "./env";

/**
 * Refreshes the Supabase session cookie on every request and guards routes.
 * Follows the @supabase/ssr Next.js pattern: return the response that setAll
 * last built (it carries the refreshed cookies), and copy those cookies onto
 * any redirect.
 */
export async function updateSession(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = isPublicPath(pathname);

  let response = NextResponse.next({ request });
  let cacheHeaders: Record<string, string> = {};

  const env = readSupabaseEnv();
  if (!env) {
    // Fail closed: without Supabase config nobody can be signed in.
    return isPublic ? response : redirectTo(request, loginPath(pathname + search), response, {});
  }

  const supabase = createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Responses that set auth cookies must not be cached (see @supabase/ssr).
        cacheHeaders = headers ?? {};
        for (const [key, value] of Object.entries(cacheHeaders)) response.headers.set(key, value);
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): getClaims()
  // is what refreshes an expired session.
  const { data } = await supabase.auth.getClaims();
  // Anonymous sessions belong to players (Phase 4 check-in). They count as
  // signed out for organizer pages, so a player's phone can still sign in here.
  const signedIn = Boolean(data?.claims?.sub) && data?.claims?.is_anonymous !== true;

  if (!signedIn && !isPublic) {
    return redirectTo(request, loginPath(pathname + search), response, cacheHeaders);
  }

  if (signedIn && pathname === "/login") {
    const next = safeNextPath(request.nextUrl.searchParams.get("next"));
    return redirectTo(request, next, response, cacheHeaders);
  }

  return response;
}

function redirectTo(
  request: NextRequest,
  path: string,
  from: NextResponse,
  cacheHeaders: Record<string, string>,
) {
  const redirect = NextResponse.redirect(new URL(path, request.url));
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  for (const [key, value] of Object.entries(cacheHeaders)) redirect.headers.set(key, value);
  return redirect;
}
