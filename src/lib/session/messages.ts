import { AUTH_MESSAGES } from "@/lib/auth/messages";
import { CLUB_ERRORS } from "@/lib/club/messages";

/** Maps errors raised by the session RPCs to plain-Taglish messages. */
export const SESSION_ERRORS = {
  liveExists: "May live na session pa. Tapusin muna iyon bago magsimula ng bago.",
  changed: "Nagbago na ang session na ito. I-refresh ang page para makita ang bago.",
  notFound: "Hindi makita ang session na ito. Baka nabura na.",
  notStaff: "Para lang sa mga organizer ng club na ito.",
  invalidInput: CLUB_ERRORS.invalidInput,
  generic: CLUB_ERRORS.generic,
} as const;

type DbErrorLike = { code?: string; message?: string };

export function sessionErrorMessage(error: DbErrorLike): string {
  switch (error.message) {
    case "live_session_exists":
      return SESSION_ERRORS.liveExists;
    case "invalid_transition":
      return SESSION_ERRORS.changed;
    case "session_not_found":
      return SESSION_ERRORS.notFound;
    case "not_staff":
      return SESSION_ERRORS.notStaff;
    case "not_organizer_account":
      return AUTH_MESSAGES.notOrganizerAccount;
  }
  if (error.code === "42501") return SESSION_ERRORS.notStaff;
  // check_violation, not_null_violation, invalid text/date input
  if (["23514", "23502", "22P02", "22007", "22008"].includes(error.code ?? "")) {
    return SESSION_ERRORS.invalidInput;
  }
  return SESSION_ERRORS.generic;
}
