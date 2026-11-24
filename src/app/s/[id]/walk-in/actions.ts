"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { queueErrorMessage } from "@/lib/queue/messages";
import { parseWalkIn, parseWalkInPayment, type WalkInInput } from "@/lib/queue/players";
import { getSession } from "@/lib/session/data";
import { SESSION_ERRORS } from "@/lib/session/messages";
import { createClient } from "@/lib/supabase/server";

export type WalkInRequest = {
  display_name: string;
  level: string;
  payment: string;
  reference: string;
  /** Set once per walk-in form on the phone, so a resend (outbox) adds them only once. */
  clientId: string;
  /** "Pumili sa members" */
  memberId: string | null;
  /** Sent from the form (not an outbox resend): open Live with the banner. */
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
  await requireUser(`/s/${encodeURIComponent(sessionId)}/walk-in`);
  const session = await getSession(sessionId);
  if (!session) return { error: SESSION_ERRORS.notFound };

  // BR13/BR20: with a fee, the organizer records how the walk-in pays (no default, D18).
  const parsed = parseWalkIn({ get: (name: string) => (name === "display_name" ? input.display_name : name === "level" ? input.level : null) });
  const paid = parseWalkInPayment(session.fee, input.payment, input.reference);
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
  if (error) return { error: queueErrorMessage(error), code: error.message };

  // A redirect from the action renders Live in the same response, so it shows the new walk-in.
  if (input.openLive) redirect(`/s/${sessionId}/live?added=${playerId}`);
  refresh();
  return { playerId };
}
