import "server-only";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

/**
 * Reads sessions as the signed-in user; RLS limits rows to the user's clubs.
 * Every query names its columns: display_token is not granted to clients, so
 * `select *` would be refused. join_code stays unread until check-in (Phase 4).
 */
const COLUMNS =
  "id, club_id, name, starts_at, ends_at, status, courts_count, court_formats, points_to, rotation, pay_first, fee, gcash_name, gcash_number, created_at, started_at, ended_at";

export type SessionStatus = "draft" | "live" | "ended";
export type Session = Pick<
  Database["public"]["Tables"]["sessions"]["Row"],
  | "id"
  | "club_id"
  | "name"
  | "starts_at"
  | "ends_at"
  | "courts_count"
  | "court_formats"
  | "points_to"
  | "rotation"
  | "pay_first"
  | "fee"
  | "gcash_name"
  | "gcash_number"
  | "created_at"
  | "started_at"
  | "ended_at"
> & { status: SessionStatus };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PAST_SESSIONS_LIMIT = 10;

/** Home lists: the live session (BR1: at most one), drafts by start, recent ended. */
export async function getHomeSessions(clubId: string) {
  const supabase = await createClient();
  const base = () => supabase.from("sessions").select(COLUMNS).eq("club_id", clubId);

  const [live, drafts, ended] = await Promise.all([
    base().eq("status", "live").maybeSingle(),
    base().eq("status", "draft").order("starts_at", { ascending: true }),
    base().eq("status", "ended").order("ended_at", { ascending: false }).limit(PAST_SESSIONS_LIMIT),
  ]);

  for (const result of [live, drafts, ended]) {
    if (result.error) throw new Error(`Could not load sessions: ${result.error.message}`);
  }

  return {
    live: (live.data as Session | null) ?? null,
    drafts: (drafts.data ?? []) as Session[],
    ended: (ended.data ?? []) as Session[],
  };
}

/** A session the user may see (staff of its club), or null. */
export async function getSession(id: string): Promise<Session | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("sessions").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load session: ${error.message}`);
  return data as Session | null;
}
