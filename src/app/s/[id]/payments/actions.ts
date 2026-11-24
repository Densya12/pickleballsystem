"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { confirmedBanner, undoneBanner, undoneConfirmBanner } from "@/lib/payments/messages";
import { playerNames } from "@/lib/queue/data";
import { queueErrorMessage } from "@/lib/queue/messages";
import { getSession } from "@/lib/session/data";
import { SESSION_ERRORS } from "@/lib/session/messages";
import { createClient } from "@/lib/supabase/server";

export type PaymentActionResult = {
  error?: string;
  /** The database's error message (e.g. "game_already_finished"), for outbox replays. */
  code?: string;
  banner?: string;
  /** Set when "Ibalik" can undo this action (D18). */
  undo?: { banner: string };
};

/** Re-checks the user and staff access (RLS); the RPCs check organizer and session again. */
async function authorize(sessionId: string): Promise<PaymentActionResult | null> {
  await requireUser(`/s/${encodeURIComponent(sessionId)}/payments`);
  return (await getSession(sessionId)) ? null : { error: SESSION_ERRORS.notFound };
}

/** "Natanggap na": pending GCash or cash -> confirmed (BR13/BR14). */
export async function confirmPaymentAction(sessionId: string, playerId: string): Promise<PaymentActionResult> {
  const denied = await authorize(sessionId);
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_payment", { p_player_id: playerId });
  if (error) return { error: queueErrorMessage(error), code: error.message };

  const [[name], { data: payment }] = await Promise.all([
    playerNames([playerId]),
    supabase.from("payments").select("method").eq("session_player_id", playerId).maybeSingle(),
  ]);
  refresh();
  return {
    banner: confirmedBanner(name, payment?.method === "cash" ? "cash" : "gcash"),
    undo: { banner: undoneConfirmBanner(name) },
  };
}

/** Back to unpaid, for mistakes. */
export async function undoPaymentAction(sessionId: string, playerId: string): Promise<PaymentActionResult> {
  const denied = await authorize(sessionId);
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.rpc("undo_payment", { p_player_id: playerId });
  if (error) return { error: queueErrorMessage(error), code: error.message };

  const [name] = await playerNames([playerId]);
  refresh();
  return { banner: undoneBanner(name) };
}
