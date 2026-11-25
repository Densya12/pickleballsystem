"use server";

import { refresh } from "next/cache";
import { memberErrorMessage } from "@/lib/members/messages";
import { createClient } from "@/lib/supabase/server";
import { authorizeSession } from "./authorize";

export type SaveMemberResult =
  | { status: "saved"; memberName: string }
  | { status: "exists"; member: { id: string; name: string } }
  | { status: "error"; error: string };

/**
 * "Save as member" (Queue sheet, Summary). With no choice yet and a member
 * of the same name, returns "exists" so the organizer can link instead.
 */
export async function saveAsMemberAction(
  sessionId: string,
  playerId: string,
  choice: { linkTo?: string; createNew?: boolean } = {},
): Promise<SaveMemberResult> {
  const { t, error: denied } = await authorizeSession(sessionId);
  if (denied) return { status: "error", error: denied };

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
  if (error) return { status: "error", error: memberErrorMessage(error, t) };

  const { data: member } = await supabase.from("members").select("display_name").eq("id", memberId).maybeSingle();
  refresh();
  return { status: "saved", memberName: member?.display_name ?? "" };
}
