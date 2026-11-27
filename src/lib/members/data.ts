import { levelFromSkill } from "@/lib/queue/players";
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Member } from "./members";

/** The club's members, by name (staff only: RLS). */
export async function getMembers(clubId: string): Promise<Member[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .select("id, display_name, skill, dues_status, notes")
    .eq("club_id", clubId)
    .order("display_name");
  if (error) throw new Error(`Could not load members: ${error.message}`);
  return (data ?? [])
    .map((m) => ({ id: m.id, name: m.display_name, level: levelFromSkill(m.skill), duesStatus: m.dues_status, notes: m.notes }))
    .sort((a, b) => a.name.localeCompare(b.name, "fil", { sensitivity: "base" }));
}

export async function getMember(id: string): Promise<Member | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("members").select("id, display_name, skill, dues_status, notes").eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load member: ${error.message}`);
  return data ? { id: data.id, name: data.display_name, level: levelFromSkill(data.skill), duesStatus: data.dues_status, notes: data.notes } : null;
}
