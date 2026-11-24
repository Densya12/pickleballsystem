"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { queueErrorMessage } from "@/lib/queue/messages";
import { parseWalkIn, type WalkInInput } from "@/lib/queue/players";
import { getSession } from "@/lib/session/data";
import { SESSION_ERRORS } from "@/lib/session/messages";
import { createClient } from "@/lib/supabase/server";

export type WalkInState = {
  error?: string;
  fieldErrors?: Partial<Record<keyof WalkInInput, string>>;
  values?: { display_name: string; level: string };
};

/** BR20: adds a walk-in at the end of the queue, then back to Live with a banner. */
export async function addWalkInAction(sessionId: string, _prev: WalkInState, formData: FormData): Promise<WalkInState> {
  await requireUser(`/s/${encodeURIComponent(sessionId)}/walk-in`);
  const values = {
    display_name: String(formData.get("display_name") ?? ""),
    level: String(formData.get("level") ?? ""),
  };
  if (!(await getSession(sessionId))) return { error: SESSION_ERRORS.notFound, values };

  const parsed = parseWalkIn(formData);
  if (!parsed.ok) return { fieldErrors: parsed.errors, values };

  const supabase = await createClient();
  const { data: playerId, error } = await supabase.rpc("add_walk_in", {
    p_session_id: sessionId,
    p_display_name: parsed.data.display_name,
    p_level: parsed.data.level,
  });
  if (error) return { error: queueErrorMessage(error), values };

  redirect(`/s/${sessionId}/live?added=${playerId}`);
}
