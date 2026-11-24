import "server-only";
import { createClient } from "@/lib/supabase/server";

/** What the club's permanent QR (/c/<code>) may know: status, live join code, club name. */
export type ClubEntry =
  | { status: "live"; joinCode: string; clubName: string }
  | { status: "none"; clubName: string }
  | { status: "not_found" };

export async function getClubEntry(code: string): Promise<ClubEntry> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("club_entry", { p_code: code }).maybeSingle();
  if (error) throw new Error(`Could not load the club QR: ${error.message}`);
  if (data?.status === "live" && data.join_code) {
    return { status: "live", joinCode: data.join_code, clubName: data.club_name };
  }
  if (data?.status === "none") return { status: "none", clubName: data.club_name };
  return { status: "not_found" };
}
