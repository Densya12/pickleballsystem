import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { loginPath } from "./paths";

/**
 * Data Access Layer for the signed-in organizer.
 * Every caller reads cookies, so render callers inside <Suspense>.
 */

export type AuthUser = { id: string; email: string | null; name: string | null };
export type Club = Database["public"]["Tables"]["clubs"]["Row"];
export type StaffRole = "owner" | "organizer";

/**
 * Verified organizer from the session (getClaims validates the JWT), or null.
 * Anonymous sessions are players (Phase 4), never organizers.
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub || data.claims.is_anonymous === true) return null;
  const metadata = (data.claims.user_metadata ?? {}) as Record<string, unknown>;
  const name = [metadata.full_name, metadata.name].find((v): v is string => typeof v === "string" && v.trim() !== "");
  return {
    id: data.claims.sub,
    email: (data.claims.email as string | undefined) ?? null,
    name: name?.trim() ?? null,
  };
});

export async function requireUser(nextPath?: string): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) redirect(loginPath(nextPath));
  return user;
}

/**
 * The user's current club. A user may belong to several clubs; Phase 1 uses
 * the oldest membership.
 */
export const getCurrentMembership = cache(
  async (userId: string): Promise<{ club: Club; role: StaffRole } | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("club_staff")
      .select("role, club:clubs!inner(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .order("club_id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`Could not load club membership: ${error.message}`);
    if (!data) return null;
    return { club: data.club, role: data.role as StaffRole };
  },
);

export async function requireClub(nextPath?: string) {
  const user = await requireUser(nextPath);
  const membership = await getCurrentMembership(user.id);
  if (!membership) redirect("/club/new");
  return { user, ...membership };
}
