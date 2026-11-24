"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { getSession } from "@/lib/session/data";
import { SESSION_ERRORS, sessionErrorMessage } from "@/lib/session/messages";
import { createClient } from "@/lib/supabase/server";

export type SessionActionResult = { error?: string };

/**
 * Each action re-checks the user and that they can see the session (staff of
 * its club, via RLS). The RPCs check staff and the allowed transition again.
 */
async function authorize(sessionId: string): Promise<SessionActionResult | null> {
  await requireUser(`/s/${encodeURIComponent(sessionId)}/live`);
  const session = await getSession(sessionId);
  return session ? null : { error: SESSION_ERRORS.notFound };
}

export async function startSessionAction(sessionId: string): Promise<SessionActionResult> {
  const denied = await authorize(sessionId);
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.rpc("start_session", { p_session_id: sessionId });
  if (error) return { error: sessionErrorMessage(error) };

  refresh();
  return {};
}

export async function endSessionAction(sessionId: string): Promise<SessionActionResult> {
  const denied = await authorize(sessionId);
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.rpc("end_session", { p_session_id: sessionId });
  if (error) return { error: sessionErrorMessage(error) };

  refresh();
  return {};
}

export async function deleteDraftSessionAction(sessionId: string): Promise<SessionActionResult> {
  const denied = await authorize(sessionId);
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_draft_session", { p_session_id: sessionId });
  if (error) return { error: sessionErrorMessage(error) };

  redirect("/");
}
