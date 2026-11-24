"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { queueErrorMessage } from "@/lib/queue/messages";
import { normalizeReference, REFERENCE_MESSAGES } from "@/lib/payments/reference";
import { parseWalkIn, type WalkInInput } from "@/lib/queue/players";
import { getSession } from "@/lib/session/data";
import { SESSION_ERRORS } from "@/lib/session/messages";
import { createClient } from "@/lib/supabase/server";

export type WalkInPayment = "cash_received" | "gcash" | "later";

export type WalkInState = {
  error?: string;
  fieldErrors?: Partial<Record<keyof WalkInInput | "payment" | "reference", string>>;
  values?: { display_name: string; level: string; payment: string; reference: string };
};

const PAYMENT_CHOICES: readonly string[] = ["cash_received", "gcash", "later"];

/** BR20: adds a walk-in at the end of the queue, then back to Live with a banner. */
export async function addWalkInAction(sessionId: string, _prev: WalkInState, formData: FormData): Promise<WalkInState> {
  await requireUser(`/s/${encodeURIComponent(sessionId)}/walk-in`);
  const values = {
    display_name: String(formData.get("display_name") ?? ""),
    level: String(formData.get("level") ?? ""),
    payment: String(formData.get("payment") ?? ""),
    reference: String(formData.get("reference") ?? ""),
  };
  const session = await getSession(sessionId);
  if (!session) return { error: SESSION_ERRORS.notFound, values };

  // BR13/BR20: with a fee, the organizer records how the walk-in pays.
  const parsed = parseWalkIn(formData);
  const paymentErrors: WalkInState["fieldErrors"] = {};
  let payment: WalkInPayment | undefined;
  if (session.fee > 0) {
    if (!PAYMENT_CHOICES.includes(values.payment)) paymentErrors.payment = "Pumili kung paano magbabayad.";
    else payment = values.payment as WalkInPayment;
    if (payment === "gcash" && !normalizeReference(values.reference)) paymentErrors.reference = REFERENCE_MESSAGES.invalid;
  }
  if (!parsed.ok || Object.keys(paymentErrors).length > 0) {
    return { fieldErrors: { ...(parsed.ok ? {} : parsed.errors), ...paymentErrors }, values };
  }

  const supabase = await createClient();
  const { data: playerId, error } = await supabase.rpc("add_walk_in", {
    p_session_id: sessionId,
    p_display_name: parsed.data.display_name,
    p_level: parsed.data.level,
    p_payment: payment,
    p_reference: payment === "gcash" ? values.reference : undefined,
  });
  if (error) return { error: queueErrorMessage(error), values };

  redirect(`/s/${sessionId}/live?added=${playerId}`);
}
