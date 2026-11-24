"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { memberErrorMessage } from "@/lib/members/messages";
import { getSession } from "@/lib/session/data";
import { SESSION_ERRORS } from "@/lib/session/messages";
import { createClient } from "@/lib/supabase/server";

export type SaveMemberResult =
  | { status: "saved"; memberName: string }
  | { status: "exists"; member: { id: string; name: string } }
  | { status: "error"; error: string };

/**
 * "I-save bilang member" (Live queue sheet, Buod). With no choice yet and a
 * member of the same name, returns "exists" so the organizer can link instead.
 */
export async function saveAsMemberAction(
  sessionId: string,
  playerId: string,
  choice: { linkTo?: string; createNew?: boolean } = {},
): Promise<SaveMemberResult> {
  await requireUser(`/s/${encodeURIComponent(sessionId)}/live`);
  if (!(await getSession(sessionId))) return { status: "error", error: SESSION_ERRORS.notFound };

  const supabase = await createClient();
  const { data: memberId, error } = await supabase.rpc("save_player_as_member", {
    p_player_id: playerId,
    p_member_id: choice.linkTo,
    p_create_new: choice.createNew ?? false,
  });
  if (error?.message === "member_exists" && error.details) {
    const { data } = await supabase.from("members").select("id, display_name").eq("id", error.details).maybeSingle();
    if (data) return { status: "exists", member: { id: data.id, name: data.display_name } };
  }
  if (error) return { status: "error", error: memberErrorMessage(error) };

  const { data: member } = await supabase.from("members").select("display_name").eq("id", memberId).maybeSingle();
  refresh();
  return { status: "saved", memberName: member?.display_name ?? "" };
}
