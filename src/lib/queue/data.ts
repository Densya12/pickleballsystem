import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Live screen data, read as the signed-in organizer (RLS: staff of the
 * session's club). Columns are named because device_id isn't granted.
 */

export type LivePlayer = {
  id: string;
  name: string;
  level: string;
  status: "queued" | "playing" | "paused";
  gamesPlayed: number;
  /** BR19: the player said "Hindi pa ako handa" from their phone. */
  notReady: boolean;
  /** unpaid | pending | confirmed (Phase 5) */
  paymentStatus: string;
  /** Linked club member (Phase 7), if any. */
  memberId: string | null;
  /** QA-05: when they joined, and whether the organizer added them (walk-in). */
  joinedAt: string;
  isWalkIn: boolean;
};
export type LiveGame = {
  id: string;
  number: number;
  format: string;
  /** ISO time the game started (minutes on the court card). */
  startedAt: string;
  players: { id: string; name: string; notReady: boolean }[];
};
export type LiveCourt = { id: string; number: number; label: string; format: string; game: LiveGame | null };
export type QueueEntry = LivePlayer & { position: number };

export type LiveState = {
  courts: LiveCourt[];
  /** Waiting players (queued and paused) in queue order (BR5). */
  queue: QueueEntry[];
  playingCount: number;
  /** Players who can be called now (BR6), for "Kailangan pa ng N player". */
  eligibleCount: number;
  /**
   * Confirmed, everyone who owes the fee (not left, or left after paying),
   * and of those, how many are pending (to check) or unpaid: the Payments badge.
   */
  payments: { paid: number; total: number; toCheck: number; unpaid: number };
};

export async function getLiveState(sessionId: string): Promise<LiveState> {
  const supabase = await createClient();
  const [courts, games, players, eligible] = await Promise.all([
    supabase.from("courts").select("id, number, label, format, current_game_id").eq("session_id", sessionId).order("number"),
    supabase.from("games").select("id, court_id, number, format, player_ids, started_at").eq("session_id", sessionId).is("ended_at", null),
    supabase
      .from("session_players")
      .select("id, display_name, level, status, games_played, queue_pos, not_ready_at, payment_status, member_id, created_at, is_walk_in")
      .eq("session_id", sessionId)
      .order("queue_pos"),
    supabase.rpc("session_eligible_count", { p_session_id: sessionId }),
  ]);
  for (const result of [courts, games, players, eligible]) {
    if (result.error) throw new Error(`Could not load the live session: ${result.error.message}`);
  }

  const allPlayers = players.data ?? [];
  const counted = allPlayers.filter((p) => p.status !== "left" || p.payment_status !== "unpaid");
  const byId = new Map(
    allPlayers
      .filter((p) => p.status !== "left")
      .map((p) => [
      p.id,
      {
        id: p.id,
        name: p.display_name,
        level: p.level,
        status: p.status as LivePlayer["status"],
        gamesPlayed: p.games_played,
        notReady: p.not_ready_at !== null,
        paymentStatus: p.payment_status,
        memberId: p.member_id,
        joinedAt: p.created_at,
        isWalkIn: p.is_walk_in,
      },
    ]),
  );
  const gameByCourt = new Map((games.data ?? []).map((g) => [g.court_id, g]));

  const liveCourts: LiveCourt[] = (courts.data ?? []).map((c) => {
    const game = gameByCourt.get(c.id);
    return {
      id: c.id,
      number: c.number,
      label: c.label,
      format: c.format,
      game: game
        ? {
            id: game.id,
            number: game.number,
            format: game.format,
            startedAt: game.started_at,
            players: game.player_ids.map((id) => ({ id, name: byId.get(id)?.name ?? "?", notReady: byId.get(id)?.notReady ?? false })),
          }
        : null,
    };
  });

  const all = [...byId.values()];
  const queue = all
    .filter((p) => p.status === "queued" || p.status === "paused")
    .map((p, index) => ({ ...p, position: index + 1 }));

  return {
    courts: liveCourts,
    queue,
    playingCount: all.filter((p) => p.status === "playing").length,
    eligibleCount: eligible.data ?? 0,
    payments: {
      paid: counted.filter((p) => p.payment_status === "confirmed").length,
      total: counted.length,
      toCheck: counted.filter((p) => p.payment_status === "pending").length,
      unpaid: counted.filter((p) => p.payment_status === "unpaid").length,
    },
  };
}

/** Names of players, in the given order. */
export async function playerNames(ids: readonly string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("session_players").select("id, display_name").in("id", [...ids]);
  if (error) throw new Error(`Could not load players: ${error.message}`);
  const names = new Map((data ?? []).map((p) => [p.id, p.display_name]));
  return ids.map((id) => names.get(id) ?? "?");
}

export async function getGame(gameId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select("id, number, player_ids, court:courts!games_court_id_fkey(label)")
    .eq("id", gameId)
    .maybeSingle();
  if (error) throw new Error(`Could not load game: ${error.message}`);
  return data ? { id: data.id, number: data.number, playerIds: data.player_ids, courtLabel: data.court?.label ?? "" } : null;
}

export async function getJoinCode(sessionId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sessions").select("join_code").eq("id", sessionId).maybeSingle();
  if (error) throw new Error(`Could not load join code: ${error.message}`);
  return data?.join_code ?? null;
}
