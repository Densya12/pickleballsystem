import type { Dictionary } from "@/lib/i18n/dictionary";

/** Sign-in problems, in the device's language (D20). */

export function validateEmail(raw: string, t: Dictionary): string | undefined {
  const email = raw.trim();
  if (!email) return t.auth.emailRequired;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return t.auth.emailInvalid;
  return undefined;
}

type AuthErrorLike = { status?: number; code?: string; message?: string };

/**
 * Supabase refuses magic links when the address isn't allowed yet (default
 * SMTP only sends to team members) or when the rate limit is hit. Those get
 * the "try Google" message.
 */
export function otpErrorMessage(error: AuthErrorLike, t: Dictionary): string {
  const refusedCodes = [
    "email_address_not_authorized",
    "over_email_send_rate_limit",
    "over_request_rate_limit",
    "email_provider_disabled",
    "signup_disabled",
  ];
  if (
    error.status === 429 ||
    (error.code && refusedCodes.includes(error.code)) ||
    /not authori[sz]ed|rate limit|security purposes/i.test(error.message ?? "")
  ) {
    return t.auth.emailRefused;
  }
  if (error.status === 400 && /email/i.test(error.message ?? "")) {
    return t.auth.emailInvalid;
  }
  return t.auth.emailFailed;
}

/** `/login?error=...` codes set by the auth routes. */
export function loginErrorMessage(code: string | undefined, t: Dictionary): string | undefined {
  if (code === "link") return t.auth.linkExpired;
  if (code) return t.auth.callbackFailed;
  return undefined;
}
