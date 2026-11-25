import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { BackLink, PageShell } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { en } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { getMembers } from "@/lib/members/data";
import { getSession } from "@/lib/session/data";
import { WalkInForm } from "./WalkInForm";
import { WalkInSkeleton } from "../_components/SessionSkeletons";

export const metadata: Metadata = {
  title: `${en.live.walkInPageTitle} · ${en.common.appName}`,
};

export default function WalkInPage({ params }: PageProps<"/s/[id]/walk-in">) {
  return (
    <Suspense fallback={<WalkInSkeleton />}>
      <WalkInContent params={params} />
    </Suspense>
  );
}

async function WalkInContent({ params }: Pick<PageProps<"/s/[id]/walk-in">, "params">) {
  const { id } = await params;
  await requireUser(`/s/${encodeURIComponent(id)}/walk-in`);
  const session = await getSession(id);
  if (!session) notFound();
  // Walk-ins only join a live queue.
  if (session.status !== "live") redirect(`/s/${session.id}`);
  const [members, t] = await Promise.all([getMembers(session.club_id), getT()]);

  return (
    <PageShell
      top={<BackLink href={`/s/${session.id}/queue`} label={t.nav.queue} />}
      title={t.live.walkInTitle}
      subtitle={t.live.walkInSubtitle}
    >
      <WalkInForm sessionId={session.id} fee={session.fee} members={members} />
    </PageShell>
  );
}
