"use server";

import { redirect } from "next/navigation";
import { requireClub } from "@/lib/auth/dal";
import { MEMBER_ERRORS } from "@/lib/members/messages";
import { parseMember, type MemberField } from "@/lib/members/members";
import { createClient } from "@/lib/supabase/server";

export type MemberFormState = {
  error?: string;
  fieldErrors?: Partial<Record<MemberField, string>>;
  values?: Partial<Record<MemberField, string>>;
};

/** Add (memberId null) or edit a member of the current club. RLS: staff of the club only. */
export async function saveMemberAction(
  memberId: string | null,
  _prev: MemberFormState,
  formData: FormData,
): Promise<MemberFormState> {
  const { club } = await requireClub("/members");
  const values = Object.fromEntries(
    (["display_name", "level", "dues_status", "notes"] as const).map((f) => [f, String(formData.get(f) ?? "")]),
  );
  const parsed = parseMember(formData);
  if (!parsed.ok) return { error: "May mali sa form. I-check ang mga naka-pula.", fieldErrors: parsed.errors, values };

  const supabase = await createClient();
  const { data, error } = memberId
    ? await supabase.from("members").update(parsed.data).eq("id", memberId).eq("club_id", club.id).select("id")
    : await supabase.from("members").insert({ ...parsed.data, club_id: club.id }).select("id");
  if (error || !data?.length) return { error: MEMBER_ERRORS.generic, values };

  redirect(`/members?saved=${encodeURIComponent(parsed.data.display_name)}`);
}
