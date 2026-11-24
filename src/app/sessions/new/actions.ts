"use server";

import { redirect } from "next/navigation";
import { requireClub } from "@/lib/auth/dal";
import { sessionErrorMessage } from "@/lib/session/messages";
import { parseNewSession, SESSION_FIELDS, type SessionField } from "@/lib/session/validation";
import { createClient } from "@/lib/supabase/server";

export type NewSessionState = {
  error?: string;
  fieldErrors?: Partial<Record<SessionField, string>>;
  /** Raw submitted values, so the form keeps what was typed after an error. */
  values?: Partial<Record<SessionField, string>>;
};

/**
 * "Simulan ang session" (intent=start) creates and starts in one database
 * transaction, then opens the session. "I-save muna" (intent=draft) saves a
 * draft and goes back Home.
 */
export async function createSessionAction(
  _prev: NewSessionState,
  formData: FormData,
): Promise<NewSessionState> {
  // Owners and organizers may both run sessions; the RPC re-checks staff.
  const { club } = await requireClub("/sessions/new");
  const start = formData.get("intent") === "start";

  const values: Partial<Record<SessionField, string>> = Object.fromEntries(
    SESSION_FIELDS.map((field) => [field, String(formData.get(field) ?? "")]),
  );
  values.pay_first = formData.get("pay_first") === null ? "" : "on";

  const parsed = parseNewSession(formData);
  if (!parsed.ok) {
    return { error: "May mali sa form. I-check ang mga naka-pula.", fieldErrors: parsed.errors, values };
  }

  const input = parsed.data;
  const supabase = await createClient();
  const { data: sessionId, error } = await supabase.rpc("create_session", {
    p_club_id: club.id,
    p_name: input.name,
    p_starts_at: input.starts_at,
    p_ends_at: input.ends_at,
    p_courts_count: input.courts_count,
    p_points_to: input.points_to,
    p_rotation: input.rotation,
    p_pay_first: input.pay_first,
    p_fee: input.fee,
    p_start: start,
  });
  if (error) return { error: sessionErrorMessage(error), values };

  redirect(start ? `/s/${sessionId}/live` : "/");
}
