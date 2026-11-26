"use server";

import { refresh } from "next/cache";
import { getGame, playerNames } from "@/lib/queue/data";
import { rotationLabel } from "@/lib/club/options";
import { finishedBanner, queueErrorMessage } from "@/lib/queue/messages";
import { levelLabel, levelNumber } from "@/lib/queue/players";
import { courtFormatLabel } from "@/lib/session/validation";
import { createClient } from "@/lib/supabase/server";
import { authorizeSession } from "./authorize";

export type QueueActionResult = {
  error?: string;
  /** The database's error message (e.g. "game_already_finished"), for outbox replays. */
  code?: string;
  banner?: string;
  /** Set when Undo can reverse this action (D18): the banner to show after undoing. */
  undo?: { banner: string };
};

async function nextGamePlayers(gameId: string | null): Promise<{ playerIds: string[]; names: string[] } | null> {
  if (!gameId) return null;
  const game = await getGame(gameId);
  return game ? { playerIds: game.playerIds, names: await playerNames(game.playerIds) } : null;
}

export async function callNextAction(sessionId: string, courtId: string): Promise<QueueActionResult> {
  const { t, error: denied } = await authorizeSession(sessionId);
  if (denied) return { error: denied };

  const supabase = await createClient();
  const { data: gameId, error } = await supabase.rpc("call_next", { p_court_id: courtId });
  if (error) return { error: queueErrorMessage(error, t), code: error.message };

  const game = await getGame(gameId);
  refresh();
  return { banner: game ? t.live.called(game.courtLabel, await playerNames(game.playerIds)) : undefined };
}

export async function finishGameAction(
  sessionId: string,
  courtId: string,
  gameId: string,
  winnerIds: string[] | null,
): Promise<QueueActionResult> {
  const { t, error: denied } = await authorizeSession(sessionId);
  if (denied) return { error: denied };

  const finished = await getGame(gameId);
  const supabase = await createClient();
  const { data: nextGameId, error } = await supabase.rpc("finish_game", {
    p_court_id: courtId,
    p_game_id: gameId,
    p_winner_ids: winnerIds ?? undefined,
  });
  if (error) return { error: queueErrorMessage(error, t), code: error.message };

  const [next, winners] = await Promise.all([
    nextGamePlayers(nextGameId),
    winnerIds ? playerNames(winnerIds) : Promise.resolve(null),
  ]);
  refresh();
  return {
    banner: finished
      ? finishedBanner(t, {
          courtLabel: finished.courtLabel,
          gameNumber: finished.number,
          finishedPlayerIds: finished.playerIds,
          winners,
          next,
        })
      : undefined,
    undo: { banner: finished ? t.live.undoneFinish(finished.courtLabel, finished.number) : t.live.undoneFinish("", 0) },
  };
}

/** BR19: replace a not-ready player with the first eligible one; they go to the front. */
export async function swapNotReadyAction(sessionId: string, courtId: string, playerId: string): Promise<QueueActionResult> {
  const { t, error: denied } = await authorizeSession(sessionId);
  if (denied) return { error: denied };

  const supabase = await createClient();
  const { data: courtRow } = await supabase.from("courts").select("label").eq("id", courtId).maybeSingle();
  const { data: newcomerId, error } = await supabase.rpc("swap_not_ready", { p_court_id: courtId, p_player_id: playerId });
  if (error) return { error: queueErrorMessage(error, t), code: error.message };

  const [out, into] = await playerNames([playerId, newcomerId]);
  refresh();
  return { banner: t.live.swapped(out, into, courtRow?.label ?? "court") };
}

/** Doubles <-> singles on an empty court. */
export async function setCourtFormatAction(
  sessionId: string,
  courtId: string,
  format: "doubles" | "singles",
): Promise<QueueActionResult> {
  const { t, error: denied } = await authorizeSession(sessionId);
  if (denied) return { error: denied };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_court_format", { p_court_id: courtId, p_format: format });
  if (error) return { error: queueErrorMessage(error, t), code: error.message };

  const { data: courtRow } = await supabase.from("courts").select("label").eq("id", courtId).maybeSingle();
  refresh();
  return { banner: t.live.formatChanged(courtRow?.label ?? "court", courtFormatLabel(format, t)) };
}

/** More › After a game: All off / Winners stay while live. It applies from the next Done. */
export async function setRotationAction(sessionId: string, rotation: "all_off" | "winners_stay"): Promise<QueueActionResult> {
  const { t, error: denied } = await authorizeSession(sessionId);
  if (denied) return { error: denied };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_session_rotation", { p_session_id: sessionId, p_rotation: rotation });
  if (error) return { error: queueErrorMessage(error, t), code: error.message };

  refresh();
  return { banner: t.live.rotationChanged(rotationLabel(rotation, t)) };
}

/** D25: the organizer changes a player's level (also on their member record). "unsure" clears it. */
export async function setPlayerLevelAction(sessionId: string, playerId: string, level: string): Promise<QueueActionResult> {
  const { t, error: denied } = await authorizeSession(sessionId);
  if (denied) return { error: denied };

  const n = levelNumber(level);
  const [name] = await playerNames([playerId]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_player_level", { p_player_id: playerId, p_skill: n as number });
  if (error) return { error: queueErrorMessage(error, t), code: error.message };

  refresh();
  return { banner: t.levels.changed(name, levelLabel(level, t)) };
}

type PlayerRpc = "pause_player" | "resume_player" | "remove_player";

async function playerAction(sessionId: string, playerId: string, rpc: PlayerRpc): Promise<QueueActionResult> {
  const { t, error: denied } = await authorizeSession(sessionId);
  if (denied) return { error: denied };

  const [name] = await playerNames([playerId]);
  const supabase = await createClient();
  const { error } = await supabase.rpc(rpc, { p_player_id: playerId });
  // QA-02: name the player when they were called onto a court meanwhile.
  if (error?.message === "player_playing") return { error: t.live.playerPlaying(name), code: error.message };
  if (error) return { error: queueErrorMessage(error, t), code: error.message };

  refresh();
  if (rpc === "remove_player") return { banner: t.live.removed(name), undo: { banner: t.live.undoneRemove(name) } };
  return { banner: rpc === "pause_player" ? t.live.paused(name) : t.live.resumed(name) };
}

export async function pausePlayerAction(sessionId: string, playerId: string) {
  return playerAction(sessionId, playerId, "pause_player");
}

export async function resumePlayerAction(sessionId: string, playerId: string) {
  return playerAction(sessionId, playerId, "resume_player");
}

export async function removePlayerAction(sessionId: string, playerId: string) {
  return playerAction(sessionId, playerId, "remove_player");
}
