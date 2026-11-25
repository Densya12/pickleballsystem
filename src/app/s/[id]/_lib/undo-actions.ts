"use server";

import { refresh } from "next/cache";
import { queueErrorMessage } from "@/lib/queue/messages";
import { createClient } from "@/lib/supabase/server";
import { authorizeSession } from "./authorize";

export type UndoActionResult = { error?: string; code?: string };

/**
 * Undo (D18), from Courts, Queue or Payments. undo_last decides on the server
 * whether the session's latest action can still be undone (30 seconds,
 * nothing else changed) and re-checks the organizer.
 */
export async function undoLastAction(sessionId: string): Promise<UndoActionResult> {
  const { t, error: denied } = await authorizeSession(sessionId);
  if (denied) return { error: denied };

  const supabase = await createClient();
  const { error } = await supabase.rpc("undo_last", { p_session_id: sessionId });
  if (error) return { error: queueErrorMessage(error, t), code: error.message };

  refresh();
  return {};
}
