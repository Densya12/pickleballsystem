import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink, PageShell } from "@/components/ui";
import { requireClub } from "@/lib/auth/dal";
import { en } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { getMember } from "@/lib/members/data";
import { MemberForm } from "../MemberForm";

export const metadata: Metadata = {
  title: `${en.members.editTitle} · ${en.common.appName}`,
};

export default function EditMemberPage({ params }: PageProps<"/members/[id]">) {
  return (
    <Suspense fallback={<PageShell>{null}</PageShell>}>
      <EditMemberContent params={params} />
    </Suspense>
  );
}

async function EditMemberContent({ params }: Pick<PageProps<"/members/[id]">, "params">) {
  const { id } = await params;
  await requireClub(`/members/${encodeURIComponent(id)}`);
  // RLS: other clubs' members aren't readable, so they get the same 404.
  const [member, t] = await Promise.all([getMember(id), getT()]);
  if (!member) notFound();

  return (
    <PageShell top={<BackLink href="/members" label={t.members.title} />} title={t.members.editTitle}>
      <MemberForm key={member.id} member={member} />
    </PageShell>
  );
}
