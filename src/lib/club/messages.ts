import { AUTH_MESSAGES } from "@/lib/auth/messages";

/** Maps errors raised by the club RPCs / RLS to plain-Taglish messages. */
export const CLUB_ERRORS = {
  generic: "May problema. Subukan ulit.",
  ownerOnly: "Ang owner lang ang pwedeng magbago nito.",
  invalidInput: "May mali sa nilagay. I-check ulit ang mga field.",
  lastOwner: "Hindi pwedeng alisin ang huling owner ng club.",
  staffNotFound: "Wala na sa club ang organizer na ito.",
  inviteInvalid: "Hindi gumagana ang invite link na ito.",
  inviteExpired: "Expired na ang invite link na ito. Humingi ng bago sa owner ng club.",
  inviteUsed: "Nagamit na ang invite link na ito. Humingi ng bago sa owner ng club.",
  inviteRevoked: "Binawi na ng owner ang invite link na ito. Humingi ng bago.",
} as const;

export type InviteStatus = "valid" | "invalid" | "expired" | "used" | "revoked";

export function inviteStatusMessage(status: Exclude<InviteStatus, "valid">): string {
  switch (status) {
    case "expired":
      return CLUB_ERRORS.inviteExpired;
    case "used":
      return CLUB_ERRORS.inviteUsed;
    case "revoked":
      return CLUB_ERRORS.inviteRevoked;
    default:
      return CLUB_ERRORS.inviteInvalid;
  }
}

type DbErrorLike = { code?: string; message?: string };

export function clubErrorMessage(error: DbErrorLike): string {
  switch (error.message) {
    case "last_owner":
      return CLUB_ERRORS.lastOwner;
    case "staff_not_found":
      return CLUB_ERRORS.staffNotFound;
    case "not_owner":
      return CLUB_ERRORS.ownerOnly;
    case "invite_invalid":
      return CLUB_ERRORS.inviteInvalid;
    case "invite_expired":
      return CLUB_ERRORS.inviteExpired;
    case "invite_used":
      return CLUB_ERRORS.inviteUsed;
    case "invite_revoked":
      return CLUB_ERRORS.inviteRevoked;
    case "not_organizer_account":
      return AUTH_MESSAGES.notOrganizerAccount;
  }
  if (error.code === "42501") return CLUB_ERRORS.ownerOnly;
  if (error.code === "23514" || error.code === "22P02") return CLUB_ERRORS.invalidInput;
  return CLUB_ERRORS.generic;
}

/** "Mag-e-expire sa loob ng N araw" for an invite's expires_at. */
export function inviteExpiryText(expiresAt: string, now: Date): string {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  const hours = Math.ceil(ms / 3_600_000);
  if (hours <= 24) return `Mag-e-expire sa loob ng ${Math.max(hours, 1)} oras`;
  return `Mag-e-expire sa loob ng ${Math.ceil(hours / 24)} araw`;
}
