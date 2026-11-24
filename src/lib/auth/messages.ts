/** Plain-Taglish messages for sign-in problems. */
export const AUTH_MESSAGES = {
  emailRequired: "Pakilagay ang email mo.",
  emailInvalid: "Mukhang mali ang email. Hal. juan@gmail.com",
  emailRefused: "Hindi maipadala ang login link ngayon. Subukan ang Google sign-in.",
  emailFailed: "Hindi naipadala ang login link. I-check ang internet mo at subukan ulit.",
  googleFailed: "Hindi mabuksan ang Google sign-in. Subukan ulit.",
  callbackFailed: "Hindi natuloy ang pag-sign in. Subukan ulit.",
  /** Most often the link was opened in another browser (e.g. inside the Gmail app). */
  linkExpired:
    "Hindi gumana ang login link. Baka expired na, nagamit na, o binuksan sa ibang browser. Humingi ng bago at buksan ito sa parehong browser kung saan ka humingi, o gamitin ang Google sign-in.",
  /** Anonymous (player) sessions can't create or join a club as staff. */
  notOrganizerAccount:
    "Kailangan ng organizer account para dito. Mag-sign out, tapos mag-sign in gamit ang Google o email.",
} as const;

export function validateEmail(raw: string): string | undefined {
  const email = raw.trim();
  if (!email) return AUTH_MESSAGES.emailRequired;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return AUTH_MESSAGES.emailInvalid;
  return undefined;
}

type AuthErrorLike = { status?: number; code?: string; message?: string };

/**
 * Supabase refuses magic links when the address isn't allowed yet (default
 * SMTP only sends to team members until custom SMTP in Phase 7) or when the
 * rate limit is hit. Those get the "try Google" message.
 */
export function otpErrorMessage(error: AuthErrorLike): string {
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
    return AUTH_MESSAGES.emailRefused;
  }
  if (error.status === 400 && /email/i.test(error.message ?? "")) {
    return AUTH_MESSAGES.emailInvalid;
  }
  return AUTH_MESSAGES.emailFailed;
}

/** `/login?error=...` codes set by the auth routes. */
export function loginErrorMessage(code: string | undefined): string | undefined {
  if (code === "link") return AUTH_MESSAGES.linkExpired;
  if (code) return AUTH_MESSAGES.callbackFailed;
  return undefined;
}
