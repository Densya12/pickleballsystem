"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { queueErrorMessage } from "@/lib/queue/messages";
import { payToFromRow } from "@/lib/payments/method";
import { parseWalkIn, parseWalkInPayment, type WalkInInput } from "@/lib/queue/players";
import { getSession } from "@/lib/session/data";
import { createClient } from "@/lib/supabase/server";
import { authorizeSession } from "./authorize";

export type WalkInRequest = {
  display_name: string;
  level: string;
  payment: string;
  reference: string;
  /** Set once per walk-in form on the phone, so a resend (outbox) adds them only once. */
  clientId: string;
  /** "From members" */
  memberId: string | null;
  /** Sent from the form (not an outbox resend): open the queue with the banner. */
  openLive?: boolean;
};

export type WalkInResult = {
  error?: string;
  /** The database's error message, for outbox replays. */
  code?: string;
  fieldErrors?: Partial<Record<keyof WalkInInput | "payment" | "reference", string>>;
  playerId?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** BR20: adds a walk-in at the end of the queue. Sent now, or later from the outbox (NF10). */
export async function addWalkInAction(sessionId: string, input: WalkInRequest): Promise<WalkInResult> {
  const { t, error: denied } = await authorizeSession(sessionId);
  if (denied) return { error: denied };
  const session = await getSession(sessionId);
  if (!session) return { error: t.session.notFound };

  // BR13/BR20: with a fee, the organizer records how the walk-in pays (no default, D18).
  const parsed = parseWalkIn({ get: (name: string) => (name === "display_name" ? input.display_name : name === "level" ? input.level : null) }, t);
  const paid = parseWalkInPayment(session.fee, input.payment, input.reference, t, payToFromRow(session));
  if (!parsed.ok || !paid.ok) {
    return { fieldErrors: { ...(parsed.ok ? {} : parsed.errors), ...(paid.ok ? {} : paid.errors) } };
  }

  const supabase = await createClient();
  const { data: playerId, error } = await supabase.rpc("add_walk_in", {
    p_session_id: sessionId,
    p_display_name: parsed.data.display_name,
    p_level: parsed.data.level,
    p_payment: paid.payment,
    p_reference: paid.payment === "gcash" ? input.reference : undefined,
    p_client_id: UUID.test(input.clientId) ? input.clientId : undefined,
    p_member_id: input.memberId && UUID.test(input.memberId) ? input.memberId : undefined,
  });
  // D18 (QA-10): the fee changed after the form was checked; ask on the payment field.
  if (error?.message === "payment_required") return { fieldErrors: { payment: t.live.choosePayment } };
  if (error) return { error: queueErrorMessage(error, t), code: error.message };

  // A redirect from the action renders the queue in the same response, so it shows the new walk-in.
  if (input.openLive) redirect(`/s/${sessionId}/queue?added=${playerId}`);
  refresh();
  return { playerId };
}
