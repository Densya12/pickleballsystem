import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink, PageShell } from "@/components/ui";
import { requireClub } from "@/lib/auth/dal";
import { en } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { MemberForm } from "../MemberForm";
import { MemberFormSkeleton } from "@/components/skeletons/OrganizerSkeletons";

export const metadata: Metadata = {
  title: `${en.members.newTitle} · ${en.common.appName}`,
};

export default function NewMemberPage() {
  return (
    <Suspense fallback={<MemberFormSkeleton edit={false} />}>
      <NewMemberContent />
    </Suspense>
  );
}

async function NewMemberContent() {
  await requireClub("/members/new");
  const t = await getT();
  return (
    <PageShell top={<BackLink href="/members" label={t.members.title} />} title={t.members.newTitle}>
      <MemberForm member={null} />
    </PageShell>
  );
}
