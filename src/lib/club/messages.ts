import type { Dictionary } from "@/lib/i18n/dictionary";

/** Errors raised by the club RPCs / RLS, in the device's language. */

export type InviteStatus = "valid" | "invalid" | "expired" | "used" | "revoked";

export function inviteStatusMessage(status: Exclude<InviteStatus, "valid">, t: Dictionary): string {
  switch (status) {
    case "expired":
      return t.club.inviteExpired;
    case "used":
      return t.club.inviteUsed;
    case "revoked":
      return t.club.inviteRevoked;
    default:
      return t.club.inviteInvalid;
  }
}

type DbErrorLike = { code?: string; message?: string };

export function clubErrorMessage(error: DbErrorLike, t: Dictionary): string {
  switch (error.message) {
    case "last_owner":
      return t.club.lastOwner;
    case "staff_not_found":
      return t.club.staffNotFound;
    case "not_owner":
      return t.club.ownerOnly;
    case "invite_invalid":
      return t.club.inviteInvalid;
    case "invite_expired":
      return t.club.inviteExpired;
    case "invite_used":
      return t.club.inviteUsed;
    case "invite_revoked":
      return t.club.inviteRevoked;
    case "not_organizer_account":
      return t.auth.notOrganizerAccount;
  }
  if (error.code === "42501") return t.club.ownerOnly;
  if (isFeeCapViolation(error)) return t.club.feeTooHigh;
  if (error.code === "23514" || error.code === "22P02") return t.club.invalidInput;
  return t.club.generic;
}

/** "Expires in N days" for an invite's expires_at. */
export function inviteExpiryText(expiresAt: string, now: Date, t: Dictionary): string {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  const hours = Math.ceil(ms / 3_600_000);
  if (hours <= 24) return t.club.inviteExpiresHours(Math.max(hours, 1));
  return t.club.inviteExpiresDays(Math.ceil(hours / 24));
}

/** QA-10: the database caps fees at FEE_MAX (sessions_fee_max, clubs_default_fee_max). */
export function isFeeCapViolation(error: { code?: string; message?: string }): boolean {
  return error.code === "23514" && /(sessions_fee_max|clubs_default_fee_max)/.test(error.message ?? "");
}
