import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Me, QueuePlayer, RunningGame } from "./state";

/**
 * Player-side reads. The check-in preview is public; everything else is read
 * as the signed-in player (RLS: players of the session) and "which row is me"
 * comes only from my_player().
 */

export type CheckinPreview = {
  status: "live" | "draft" | "ended" | "not_found";
  name: string | null;
  startsAt: string | null;
  endsAt: string | null;
  courtsCount: number | null;
  waiting: number | null;
};

export async function getCheckinPreview(code: string): Promise<CheckinPreview> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("checkin_preview", { p_join_code: code }).maybeSingle();
  if (error) throw new Error(`Could not load check-in: ${error.message}`);
  return {
    status: (data?.status ?? "not_found") as CheckinPreview["status"],
    name: data?.name ?? null,
    startsAt: data?.starts_at ?? null,
    endsAt: data?.ends_at ?? null,
    courtsCount: data?.courts_count ?? null,
    waiting: data?.waiting ?? null,
  };
}

export type PlayerSessionView = {
  session: { id: string; name: string; status: string; startsAt: string; endsAt: string };
  me: Me | null;
  players: QueuePlayer[];
  games: RunningGame[];
};

/** The session behind a join code, if the caller may read it (player or staff). */
export async function getPlayerSessionView(code: string): Promise<PlayerSessionView | null> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return null;

  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, name, status, starts_at, ends_at")
    .eq("join_code", code)
    .maybeSingle();
  if (error) throw new Error(`Could not load session: ${error.message}`);
  if (!session) return null;

  const [me, players, courts, games] = await Promise.all([
    supabase.rpc("my_player", { p_session_id: session.id }).maybeSingle(),
    supabase
      .from("session_players")
      .select("id, display_name, status, queue_pos")
      .eq("session_id", session.id)
      .neq("status", "left")
      .order("queue_pos"),
    supabase.from("courts").select("id, label").eq("session_id", session.id),
    supabase.from("games").select("id, number, court_id, player_ids").eq("session_id", session.id).is("ended_at", null),
  ]);
  for (const result of [me, players, courts, games]) {
    if (result.error) throw new Error(`Could not load your place in line: ${result.error.message}`);
  }

  const courtLabel = new Map((courts.data ?? []).map((c) => [c.id, c.label]));
  return {
    session: {
      id: session.id,
      name: session.name,
      status: session.status,
      startsAt: session.starts_at,
      endsAt: session.ends_at,
    },
    me: me.data
      ? { id: me.data.id, name: me.data.display_name, status: me.data.status, notReady: me.data.not_ready_at !== null }
      : null,
    players: (players.data ?? []).map((p) => ({ id: p.id, name: p.display_name, status: p.status, queuePos: p.queue_pos })),
    games: (games.data ?? []).map((g) => ({
      id: g.id,
      number: g.number,
      courtLabel: courtLabel.get(g.court_id) ?? "",
      playerIds: g.player_ids,
    })),
  };
}
