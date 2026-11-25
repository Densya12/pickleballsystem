import type { Dictionary } from "@/lib/i18n/dictionary";
import { paymentErrorMessage } from "@/lib/payments/messages";
import { sessionErrorMessage } from "@/lib/session/messages";

/** Errors from the queue RPCs, in the device's language. Banners are in t.live. */

type DbErrorLike = { code?: string; message?: string; details?: string | null };

export function queueErrorMessage(error: DbErrorLike, t: Dictionary): string {
  const payment = paymentErrorMessage(error, t);
  if (payment) return payment;
  switch (error.message) {
    case "not_enough_players": {
      const needed = Number(error.details);
      return Number.isInteger(needed) && needed > 0 ? t.live.needPlayers(needed) : t.live.notEnough;
    }
    case "game_already_finished":
      return t.live.alreadyFinished;
    case "court_busy":
      return t.live.courtBusy;
    case "invalid_winners":
      return t.live.invalidWinners;
    case "invalid_player_status":
      return t.live.playerChanged;
    case "session_not_live":
      return t.live.notLive;
    case "invalid_format":
      return t.live.invalidFormat;
    case "player_not_on_court":
      return t.live.notOnCourt;
    case "undo_not_available":
      return t.live.undoNotAvailable;
    case "court_not_found":
    case "player_not_found":
    case "game_not_found":
      return t.live.notFound;
    case "not_organizer_account":
      return t.auth.notOrganizerAccount;
  }
  return sessionErrorMessage(error, t);
}
