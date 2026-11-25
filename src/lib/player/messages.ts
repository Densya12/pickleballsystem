import type { Dictionary } from "@/lib/i18n/dictionary";
import { isNetworkError } from "@/lib/outbox/rules";
import { paymentErrorMessage } from "@/lib/payments/messages";

type DbErrorLike = { code?: string; message?: string };

/** Errors on the player screens, in the device's language. */
export function playerErrorMessage(error: DbErrorLike, t: Dictionary): string {
  const payment = paymentErrorMessage(error, t);
  if (payment) return payment;
  switch (error.message) {
    case "checkin_closed":
      return t.player.closedError;
    case "session_not_found":
      return t.player.notFound;
    case "session_not_live":
      return t.player.ended;
    case "invalid_player_status":
      return t.player.changed;
    case "player_not_found":
      return t.player.noRow;
    case "name_taken":
      return t.player.nameTaken;
    case "session_full":
      return t.player.sessionFull;
    case "name_needs_letter":
      return t.live.nameNeedsLetter;
  }
  if (error.code === "23514" || error.code === "23502") return t.player.invalidInput;
  // supabase-js reports a failed fetch as an error object, not a throw.
  if (isNetworkError(new Error(error.message ?? ""))) return t.live.network;
  return t.common.genericError;
}
