"use server";

import { redirect } from "next/navigation";
import { requireClub } from "@/lib/auth/dal";
import { getT } from "@/lib/i18n/server";
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
 * "Start session" (intent=start) creates and starts in one database
 * transaction, then opens Courts. "Save as draft" (intent=draft) saves a
 * draft and goes back Home.
 */
export async function createSessionAction(_prev: NewSessionState, formData: FormData): Promise<NewSessionState> {
  // Owners and organizers may both run sessions; the RPC re-checks staff.
  const { club } = await requireClub("/sessions/new");
  const t = await getT();
  const start = formData.get("intent") === "start";

  const values: Partial<Record<SessionField, string>> = Object.fromEntries(
    SESSION_FIELDS.map((field) => [field, String(formData.get(field) ?? "")]),
  );
  values.pay_first = formData.get("pay_first") === null ? "" : "on";
  values.court_formats = Array.from({ length: 8 }, (_, i) => String(formData.get(`court_format_${i + 1}`) ?? ""))
    .filter(Boolean)
    .join(",");

  const parsed = parseNewSession(formData, t);
  if (!parsed.ok) return { error: t.common.formError, fieldErrors: parsed.errors, values };

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
    p_court_formats: input.court_formats,
  });
  if (error) return { error: sessionErrorMessage(error, t), values };

  // D25: who plays together (create_session takes the club's default; same signature as before).
  const { error: presetError } = await supabase.rpc("set_session_matchmaking", {
    p_session_id: sessionId,
    p_matchmaking: input.matchmaking,
  });
  if (presetError) return { error: sessionErrorMessage(presetError, t), values };

  // D26: what Done does next (create_session takes the club's default; same signature as before).
  const { error: callModeError } = await supabase.rpc("set_session_call_mode", {
    p_session_id: sessionId,
    p_call_mode: input.call_mode,
  });
  if (callModeError) return { error: sessionErrorMessage(callModeError, t), values };

  redirect(start ? `/s/${sessionId}` : "/");
}
