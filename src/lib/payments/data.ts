import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PayingPlayer, PaymentStatus } from "./summary";

/** Every player of the session with their payment (staff only: RLS). */
export async function getSessionPayments(sessionId: string): Promise<PayingPlayer[]> {
  const supabase = await createClient();
  const [players, payments] = await Promise.all([
    supabase.from("session_players").select("id, display_name, status, payment_status, queue_pos, games_played").eq("session_id", sessionId).order("queue_pos"),
    supabase.from("payments").select("session_player_id, method, reference_digits, amount").eq("session_id", sessionId),
  ]);
  if (players.error) throw new Error(`Could not load players: ${players.error.message}`);
  if (payments.error) throw new Error(`Could not load payments: ${payments.error.message}`);

  const byPlayer = new Map((payments.data ?? []).map((p) => [p.session_player_id, p]));
  return (players.data ?? []).map((p) => {
    const payment = byPlayer.get(p.id);
    return {
      id: p.id,
      name: p.display_name,
      status: p.status,
      paymentStatus: p.payment_status as PaymentStatus,
      method: (payment?.method ?? null) as PayingPlayer["method"],
      referenceDigits: payment?.reference_digits ?? null,
      amount: payment?.amount ?? null,
      gamesPlayed: p.games_played,
    };
  });
}
