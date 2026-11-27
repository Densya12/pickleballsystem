import type { OutboxItem } from "@/lib/outbox/rules";
import {
  callMixedAction,
  callNextAction,
  finishGameAction,
  pausePlayerAction,
  removePlayerAction,
  resumePlayerAction,
  setCourtFormatAction,
  setMatchmakingAction,
  setCallModeAction,
  setPlayerLevelAction,
  setRotationAction,
  swapNotReadyAction,
  type QueueActionResult,
} from "./queue-actions";
import { confirmPaymentAction } from "./payment-actions";
import { addWalkInAction, type WalkInRequest } from "./walk-in-actions";

export type SentResult = QueueActionResult & { playerId?: string; fieldErrors?: Record<string, string | undefined> };

const str = (value: unknown) => String(value ?? "");

/**
 * Sends one organizer action (now, or from the outbox). A network failure
 * throws, as the Server Action call does.
 */
export async function sendOrganizerAction(item: Pick<OutboxItem, "kind" | "sessionId" | "args">): Promise<SentResult> {
  const { sessionId, args } = item;
  switch (item.kind) {
    case "call_next":
      return callNextAction(sessionId, str(args.courtId));
    case "call_mixed":
      return callMixedAction(sessionId, str(args.courtId));
    case "finish_game":
      return finishGameAction(sessionId, str(args.courtId), str(args.gameId), Array.isArray(args.winnerIds) ? args.winnerIds : null);
    case "swap_not_ready":
      return swapNotReadyAction(sessionId, str(args.courtId), str(args.playerId));
    case "set_court_format":
      return setCourtFormatAction(sessionId, str(args.courtId), args.format === "singles" ? "singles" : "doubles");
    case "set_rotation":
      return setRotationAction(sessionId, args.rotation === "winners_stay" ? "winners_stay" : "all_off");
    case "set_matchmaking":
      return setMatchmakingAction(sessionId, str(args.matchmaking));
    case "set_call_mode":
      return setCallModeAction(sessionId, str(args.callMode));
    case "set_player_level":
      return setPlayerLevelAction(sessionId, str(args.playerId), str(args.level));
    case "pause_player":
      return pausePlayerAction(sessionId, str(args.playerId));
    case "resume_player":
      return resumePlayerAction(sessionId, str(args.playerId));
    case "remove_player":
      return removePlayerAction(sessionId, str(args.playerId));
    case "confirm_payment":
      return confirmPaymentAction(sessionId, str(args.playerId));
    case "add_walk_in": {
      const result = await addWalkInAction(sessionId, args as unknown as WalkInRequest);
      // A field error on replay can't be fixed from the outbox: report it as a failure.
      const field = result.fieldErrors ? Object.values(result.fieldErrors).find(Boolean) : undefined;
      return field ? { ...result, error: field } : result;
    }
  }
}
