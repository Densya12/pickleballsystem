"use server";

import { refresh } from "next/cache";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { queueErrorMessage } from "@/lib/queue/messages";
import { createClient } from "@/lib/supabase/server";
import { authorizeSession } from "./authorize";

export type CorrectGameResult = { error?: string; code?: string; banner?: string };

function correctionError(error: { message?: string; code?: string }, t: Dictionary): string {
  switch (error.message) {
    case "game_not_finished":
      return t.games.gameNotFinished;
    case "invalid_players":
      return t.games.invalidTeams;
    case "invalid_winners":
      return t.games.invalidResult;
    case "game_not_found":
      return t.games.gameNotFound;
    case "session_not_started":
      return t.games.notStarted;
  }
  return queueErrorMessage(error, t);
}

/**
 * D27: correct a finished game's result and/or teams (same players). The
 * record only: courts and the queue stay as they are. Staff only; the
 * database checks the rest (live or ended session, a full side wins).
 */
export async function correctGameAction(
  sessionId: string,
  gameId: string,
  playerIds: string[],
  winnerIds: string[] | null,
): Promise<CorrectGameResult> {
  const { t, error: denied } = await authorizeSession(sessionId);
  if (denied) return { error: denied };

  const supabase = await createClient();
  const { error } = await supabase.rpc("correct_game", {
    p_game_id: gameId,
    p_player_ids: playerIds,
    p_winner_ids: winnerIds ?? undefined,
  });
  if (error) return { error: correctionError(error, t), code: error.message };

  refresh();
  return { banner: t.games.fixed };
}
