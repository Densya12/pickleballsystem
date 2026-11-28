import "server-only";
import { createClient } from "@/lib/supabase/server";
import { newestFirst, type LogGame, type StandingRow } from "./log";

/**
 * D27 reads. The match log is for staff (RLS: staff of the session's club);
 * standings come from session_standings (staff and the session's players).
 */

/** Finished games, newest first, with every player's name (players who left too). */
export async function getMatchLog(sessionId: string): Promise<{ games: LogGame[]; names: Record<string, string> }> {
  const supabase = await createClient();
  const [games, courts, players] = await Promise.all([
    supabase
      .from("games")
      .select("id, number, court_id, format, player_ids, winner_ids, started_at")
      .eq("session_id", sessionId)
      .not("ended_at", "is", null),
    supabase.from("courts").select("id, label").eq("session_id", sessionId),
    supabase.from("session_players").select("id, display_name").eq("session_id", sessionId),
  ]);
  for (const result of [games, courts, players]) {
    if (result.error) throw new Error(`Could not load the games: ${result.error.message}`);
  }
  const courtLabel = new Map((courts.data ?? []).map((c) => [c.id, c.label]));
  return {
    games: newestFirst(
      (games.data ?? []).map((g) => ({
        id: g.id,
        number: g.number,
        courtLabel: courtLabel.get(g.court_id) ?? "",
        format: g.format,
        startedAt: g.started_at,
        playerIds: g.player_ids,
        winnerIds: g.winner_ids,
      })),
    ),
    names: Object.fromEntries((players.data ?? []).map((p) => [p.id, p.display_name])),
  };
}

/** Wins, losses and games per player, ranked by the database. Null when the caller can't read them. */
export async function getStandings(sessionId: string): Promise<StandingRow[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("session_standings", { p_session_id: sessionId });
  if (error) return null;
  return (data ?? []).map((row) => ({
    playerId: row.session_player_id,
    name: row.display_name,
    wins: row.wins,
    losses: row.losses,
    games: row.games,
    rank: row.rank,
  }));
}
