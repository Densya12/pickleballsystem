import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { BackLink, PageShell } from "@/components/ui";
import { requireClub } from "@/lib/auth/dal";
import { inviteExpiryText } from "@/lib/club/messages";
import { originFromHeaders } from "@/lib/http/origin";
import { en } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { StaffSection, type InviteItem, type StaffItem } from "../StaffSection";

export const metadata: Metadata = {
  title: `${en.settings.coOrganizers} · ${en.common.appName}`,
};

export default function OrganizersPage() {
  return (
    <Suspense fallback={<PageShell>{null}</PageShell>}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const [{ user, club, role }, t] = await Promise.all([requireClub("/settings/organizers"), getT()]);
  const isOwner = role === "owner";
  const supabase = await createClient();
  const now = new Date();

  const [staffResult, invitesResult, headerList] = await Promise.all([
    supabase.rpc("list_club_staff", { p_club_id: club.id }),
    isOwner
      ? supabase
          .from("club_invites")
          .select("id, token, expires_at")
          .eq("club_id", club.id)
          .is("used_at", null)
          .is("revoked_at", null)
          .gt("expires_at", now.toISOString())
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    headers(),
  ]);
  if (staffResult.error) throw new Error(`Could not load organizers: ${staffResult.error.message}`);
  if (invitesResult.error) throw new Error(`Could not load invites: ${invitesResult.error.message}`);

  const origin = originFromHeaders(headerList);
  const staff: StaffItem[] = staffResult.data.map((s) => ({
    userId: s.user_id,
    role: s.role === "owner" ? "owner" : "organizer",
    name: s.display_name,
    email: s.email,
    isMe: s.user_id === user.id,
  }));
  const invites: InviteItem[] = (invitesResult.data ?? []).map((i) => ({
    id: i.id,
    url: `${origin}/invite/${i.token}`,
    expiryText: inviteExpiryText(i.expires_at, now, t),
  }));

  return (
    <PageShell top={<BackLink href="/settings" label={t.settings.title} />} title={t.settings.coOrganizers}>
      <StaffSection isOwner={isOwner} staff={staff} invites={invites} />
    </PageShell>
  );
}
