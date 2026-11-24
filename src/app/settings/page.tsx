import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { BackLink, PageShell } from "@/components/ui";
import { requireClub } from "@/lib/auth/dal";
import { inviteExpiryText } from "@/lib/club/messages";
import { originFromHeaders } from "@/lib/http/origin";
import { createClient } from "@/lib/supabase/server";
import { SettingsView, type InviteItem, type StaffItem } from "./SettingsView";

export const metadata: Metadata = {
  title: "Settings ng club · Open Play Queue",
};

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <PageShell header={<SettingsHeader />}>
          <p className="text-muted">Sandali lang…</p>
        </PageShell>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}

function SettingsHeader() {
  return (
    <div className="flex flex-col gap-1">
      <BackLink href="/" />
      <h1 className="text-3xl">Settings ng club</h1>
    </div>
  );
}

async function SettingsContent() {
  const { user, club, role } = await requireClub("/settings");
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
    expiryText: inviteExpiryText(i.expires_at, now),
  }));

  return (
    <SettingsView
      header={<SettingsHeader />}
      club={{
        name: club.name,
        city: club.city ?? "",
        gcash_name: club.gcash_name ?? "",
        gcash_number: club.gcash_number ?? "",
        default_fee: String(club.default_fee),
        default_points: String(club.default_points),
        default_rotation: club.default_rotation,
      }}
      isOwner={isOwner}
      staff={staff}
      invites={invites}
    />
  );
}
