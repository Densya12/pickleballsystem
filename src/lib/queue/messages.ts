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
    case "invalid_rotation":
      return t.live.invalidRotation;
    case "player_not_on_court":
      return t.live.notOnCourt;
    case "player_playing":
      return t.live.playerPlayingGeneric;
    case "payment_required":
      return t.live.choosePayment;
    case "player_not_flagged":
      return t.live.notFlagged;
    case "session_full":
      return t.live.sessionFull;
    case "name_needs_letter":
      return t.live.nameNeedsLetter;
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

/** True when both games have exactly the same players (in any order). */
export function samePlayers(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/**
 * The banner after Done (NF8). When the next game has exactly the players who
 * just finished (nobody else is eligible), say so: otherwise the court looks
 * unchanged and Done looks like it did nothing.
 */
export function finishedBanner(
  t: Dictionary,
  input: {
    courtLabel: string;
    gameNumber: number;
    finishedPlayerIds: readonly string[];
    winners?: readonly string[] | null;
    next: { playerIds: readonly string[]; names: readonly string[] } | null;
  },
): string {
  if (input.next && samePlayers(input.finishedPlayerIds, input.next.playerIds)) {
    return t.live.playAgain(input.next.names, input.courtLabel);
  }
  return t.live.finished({
    courtLabel: input.courtLabel,
    gameNumber: input.gameNumber,
    winners: input.winners,
    next: input.next ? input.next.names : null,
  });
}
