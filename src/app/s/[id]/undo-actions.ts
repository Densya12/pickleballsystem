"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { queueErrorMessage } from "@/lib/queue/messages";
import { getSession } from "@/lib/session/data";
import { SESSION_ERRORS } from "@/lib/session/messages";
import { createClient } from "@/lib/supabase/server";

export type UndoActionResult = { error?: string; code?: string };

/**
 * "Ibalik" (D18), from Live or Bayad. undo_last decides on the server whether
 * the session's latest action can still be undone (30 seconds, nothing else
 * changed) and re-checks the organizer.
 */
export async function undoLastAction(sessionId: string): Promise<UndoActionResult> {
  await requireUser(`/s/${encodeURIComponent(sessionId)}/live`);
  if (!(await getSession(sessionId))) return { error: SESSION_ERRORS.notFound };

  const supabase = await createClient();
  const { error } = await supabase.rpc("undo_last", { p_session_id: sessionId });
  if (error) return { error: queueErrorMessage(error), code: error.message };

  refresh();
  return {};
}
