import { isFeeCapViolation } from "@/lib/club/messages";
import type { Dictionary } from "@/lib/i18n/dictionary";

type DbErrorLike = { code?: string; message?: string };

/** Errors raised by the session RPCs, in the device's language. */
export function sessionErrorMessage(error: DbErrorLike, t: Dictionary): string {
  switch (error.message) {
    case "live_session_exists":
      return t.session.liveExists;
    case "invalid_transition":
      return t.session.changed;
    case "session_not_found":
      return t.session.notFound;
    case "not_staff":
      return t.session.notStaff;
    case "not_organizer_account":
      return t.auth.notOrganizerAccount;
  }
  if (error.code === "42501") return t.session.notStaff;
  if (isFeeCapViolation(error)) return t.club.feeTooHigh;
  // check_violation, not_null_violation, invalid text/date input
  if (["23514", "23502", "22P02", "22007", "22008"].includes(error.code ?? "")) {
    return t.club.invalidInput;
  }
  return t.club.generic;
}
