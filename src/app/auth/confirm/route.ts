import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/paths";
import { originFromHeaders } from "@/lib/http/origin";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic link confirmation.
 * - Custom template (supabase/templates/magic_link.html): ?token_hash=&type=email
 *   → verifyOtp. Works even if the link is opened in a different browser.
 * - Default Supabase template: ?code= → exchangeCodeForSession (same browser only).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  const origin =
    process.env.NODE_ENV === "development"
      ? request.nextUrl.origin
      : originFromHeaders(request.headers, request.url);

  if ((tokenHash && type) || code) {
    const supabase = await createClient();
    const { error } =
      tokenHash && type
        ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
        : await supabase.auth.exchangeCodeForSession(code!);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  const login = new URL("/login", origin);
  login.searchParams.set("error", "link");
  if (next !== "/") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}
