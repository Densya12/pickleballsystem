"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { getGame, playerNames } from "@/lib/queue/data";
import {
  calledBanner,
  finishedBanner,
  pausedBanner,
  queueErrorMessage,
  removedBanner,
  resumedBanner,
  swappedBanner,
} from "@/lib/queue/messages";
import { getSession } from "@/lib/session/data";
import { SESSION_ERRORS } from "@/lib/session/messages";
import { createClient } from "@/lib/supabase/server";

export type QueueActionResult = { error?: string; banner?: string };

/**
 * Re-checks the user and that they can see this session (staff, via RLS).
 * The RPCs check staff, anonymous sessions and "live" again.
 */
async function authorize(sessionId: string): Promise<QueueActionResult | null> {
  await requireUser(`/s/${encodeURIComponent(sessionId)}/live`);
  return (await getSession(sessionId)) ? null : { error: SESSION_ERRORS.notFound };
}

async function nextGameBanner(gameId: string | null): Promise<string[] | null> {
  if (!gameId) return null;
  const game = await getGame(gameId);
  return game ? playerNames(game.playerIds) : null;
}

export async function callNextAction(sessionId: string, courtId: string): Promise<QueueActionResult> {
  const denied = await authorize(sessionId);
  if (denied) return denied;

  const supabase = await createClient();
  const { data: gameId, error } = await supabase.rpc("call_next", { p_court_id: courtId });
  if (error) return { error: queueErrorMessage(error) };

  const game = await getGame(gameId);
  refresh();
  return { banner: game ? calledBanner(game.courtLabel, await playerNames(game.playerIds)) : undefined };
}

export async function finishGameAction(
  sessionId: string,
  courtId: string,
  gameId: string,
  winnerIds: string[] | null,
): Promise<QueueActionResult> {
  const denied = await authorize(sessionId);
  if (denied) return denied;

  const finished = await getGame(gameId);
  const supabase = await createClient();
  const { data: nextGameId, error } = await supabase.rpc("finish_game", {
    p_court_id: courtId,
    p_game_id: gameId,
    p_winner_ids: winnerIds ?? undefined,
  });
  if (error) return { error: queueErrorMessage(error) };

  const [next, winners] = await Promise.all([
    nextGameBanner(nextGameId),
    winnerIds ? playerNames(winnerIds) : Promise.resolve(null),
  ]);
  refresh();
  return {
    banner: finished
      ? finishedBanner({ courtLabel: finished.courtLabel, gameNumber: finished.number, winners, next })
      : undefined,
  };
}

/** BR19: replace a not-ready player with the first eligible one; they go to the front. */
export async function swapNotReadyAction(
  sessionId: string,
  courtId: string,
  playerId: string,
): Promise<QueueActionResult> {
  const denied = await authorize(sessionId);
  if (denied) return denied;

  const supabase = await createClient();
  const { data: courtRow } = await supabase.from("courts").select("label").eq("id", courtId).maybeSingle();
  const { data: newcomerId, error } = await supabase.rpc("swap_not_ready", { p_court_id: courtId, p_player_id: playerId });
  if (error) return { error: queueErrorMessage(error) };

  const [out, into] = await playerNames([playerId, newcomerId]);
  refresh();
  return { banner: swappedBanner(out, into, courtRow?.label ?? "court") };
}

type PlayerRpc = "pause_player" | "resume_player" | "remove_player";

async function playerAction(
  sessionId: string,
  playerId: string,
  rpc: PlayerRpc,
  banner: (name: string) => string,
): Promise<QueueActionResult> {
  const denied = await authorize(sessionId);
  if (denied) return denied;

  const [name] = await playerNames([playerId]);
  const supabase = await createClient();
  const { error } = await supabase.rpc(rpc, { p_player_id: playerId });
  if (error) return { error: queueErrorMessage(error) };

  refresh();
  return { banner: banner(name) };
}

export async function pausePlayerAction(sessionId: string, playerId: string) {
  return playerAction(sessionId, playerId, "pause_player", pausedBanner);
}

export async function resumePlayerAction(sessionId: string, playerId: string) {
  return playerAction(sessionId, playerId, "resume_player", resumedBanner);
}

export async function removePlayerAction(sessionId: string, playerId: string) {
  return playerAction(sessionId, playerId, "remove_player", removedBanner);
}
