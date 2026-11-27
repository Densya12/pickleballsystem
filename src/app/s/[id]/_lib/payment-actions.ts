"use server";

import { refresh } from "next/cache";
import { playerNames } from "@/lib/queue/data";
import { queueErrorMessage } from "@/lib/queue/messages";
import { methodName, payToFromRow } from "@/lib/payments/method";
import { createClient } from "@/lib/supabase/server";
import { authorizeSession } from "./authorize";

export type PaymentActionResult = {
  error?: string;
  /** The database's error message, for outbox replays. */
  code?: string;
  banner?: string;
  /** Set when Undo can reverse this action (D18). */
  undo?: { banner: string };
};

/** "Received": a pending transfer (the club's payment method) or cash -> confirmed (BR13/BR14). */
export async function confirmPaymentAction(sessionId: string, playerId: string): Promise<PaymentActionResult> {
  const { t, error: denied } = await authorizeSession(sessionId);
  if (denied) return { error: denied };

  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_payment", { p_player_id: playerId });
  if (error) return { error: queueErrorMessage(error, t), code: error.message };

  const [[name], { data: payment }, { data: session }] = await Promise.all([
    playerNames([playerId]),
    supabase.from("payments").select("method").eq("session_player_id", playerId).maybeSingle(),
    supabase
      .from("sessions")
      .select("payment_method, payment_method_other, gcash_name, gcash_number, cash_accepted")
      .eq("id", sessionId)
      .maybeSingle(),
  ]);
  refresh();
  return {
    banner: payment?.method === "cash" ? t.payments.confirmedCash(name) : t.payments.confirmedTransfer(name, session ? methodName(t, payToFromRow(session)) : t.payments.methodOther),
    undo: { banner: t.payments.undoneConfirm(name) },
  };
}

/** Back to unpaid, for mistakes. */
export async function undoPaymentAction(sessionId: string, playerId: string): Promise<PaymentActionResult> {
  const { t, error: denied } = await authorizeSession(sessionId);
  if (denied) return { error: denied };

  const supabase = await createClient();
  const { error } = await supabase.rpc("undo_payment", { p_player_id: playerId });
  if (error) return { error: queueErrorMessage(error, t), code: error.message };

  const [name] = await playerNames([playerId]);
  refresh();
  return { banner: t.payments.undone(name) };
}
