"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { sessionErrorMessage } from "@/lib/session/messages";
import { createClient } from "@/lib/supabase/server";
import { authorizeSession } from "./authorize";

export type SessionActionResult = { error?: string };

export async function startSessionAction(sessionId: string): Promise<SessionActionResult> {
  const { t, error: denied } = await authorizeSession(sessionId);
  if (denied) return { error: denied };

  const supabase = await createClient();
  const { error } = await supabase.rpc("start_session", { p_session_id: sessionId });
  if (error) return { error: sessionErrorMessage(error, t) };

  refresh();
  return {};
}

export async function endSessionAction(sessionId: string): Promise<SessionActionResult> {
  const { t, error: denied } = await authorizeSession(sessionId);
  if (denied) return { error: denied };

  const supabase = await createClient();
  const { error } = await supabase.rpc("end_session", { p_session_id: sessionId });
  if (error) return { error: sessionErrorMessage(error, t) };

  // The summary lives at the session's main address.
  redirect(`/s/${sessionId}`);
}

export async function deleteDraftSessionAction(sessionId: string): Promise<SessionActionResult> {
  const { t, error: denied } = await authorizeSession(sessionId);
  if (denied) return { error: denied };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_draft_session", { p_session_id: sessionId });
  if (error) return { error: sessionErrorMessage(error, t) };

  redirect("/");
}
