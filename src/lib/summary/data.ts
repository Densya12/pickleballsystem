import { levelFromSkill } from "@/lib/queue/players";
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PaymentStatus } from "@/lib/payments/summary";
import type { SummaryPlayer } from "./summary";

/** Every player row of the session with their payment, and the number of games (staff only: RLS). */
export async function getSummaryData(sessionId: string): Promise<{ players: SummaryPlayer[]; gamesCount: number }> {
  const supabase = await createClient();
  const [players, payments, games, standings] = await Promise.all([
    supabase
      .from("session_players")
      .select("id, display_name, skill, status, is_walk_in, games_played, payment_status, member_id, created_at")
      .eq("session_id", sessionId)
      .order("created_at"),
    supabase.from("payments").select("session_player_id, method, reference_digits, amount").eq("session_id", sessionId),
    supabase.from("games").select("id", { count: "exact", head: true }).eq("session_id", sessionId),
    // D27: wins and losses per player (only players with a finished game have a row).
    supabase.rpc("session_standings", { p_session_id: sessionId }),
  ]);
  for (const result of [players, payments, games]) {
    if (result.error) throw new Error(`Could not load the summary: ${result.error.message}`);
  }

  const byPlayer = new Map((payments.data ?? []).map((p) => [p.session_player_id, p]));
  const record = new Map((standings.data ?? []).map((s) => [s.session_player_id, s]));
  return {
    gamesCount: games.count ?? 0,
    players: (players.data ?? []).map((p) => {
      const payment = byPlayer.get(p.id);
      return {
        id: p.id,
        name: p.display_name,
        status: p.status,
        level: levelFromSkill(p.skill),
        isWalkIn: p.is_walk_in,
        gamesPlayed: p.games_played,
        checkedInAt: p.created_at,
        memberId: p.member_id,
        paymentStatus: p.payment_status as PaymentStatus,
        method: (payment?.method ?? null) as SummaryPlayer["method"],
        referenceDigits: payment?.reference_digits ?? null,
        amount: payment?.amount ?? null,
        wins: record.get(p.id)?.wins ?? 0,
        losses: record.get(p.id)?.losses ?? 0,
      };
    }),
  };
}
