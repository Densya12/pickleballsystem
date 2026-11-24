import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/paths";
import { originFromHeaders } from "@/lib/http/origin";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth (Google) PKCE callback: exchange ?code= for a session cookie.
 * Per the Supabase Next.js server-side auth docs.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  const origin =
    process.env.NODE_ENV === "development"
      ? request.nextUrl.origin
      : originFromHeaders(request.headers, request.url);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  const login = new URL("/login", origin);
  login.searchParams.set("error", "auth");
  if (next !== "/") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}
