import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { OfflineNavGuard } from "@/components/session/OfflineNavGuard";
import { BackLink, PageShell } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { getMatchLog, getStandings } from "@/lib/games/data";
import { en } from "@/lib/i18n/dictionary";
import { getT } from "@/lib/i18n/server";
import { getSession } from "@/lib/session/data";
import { GamesSkeleton } from "../_components/SessionSkeletons";
import { GamesView } from "./GamesView";

export const metadata: Metadata = {
  title: en.games.pageTitle,
};

/** Games & standings (D27): the match log and standings, for staff. Live or ended sessions. */
export default function GamesPage({ params }: PageProps<"/s/[id]/games">) {
  return (
    <Suspense fallback={<GamesSkeleton />}>
      <GamesContent params={params} />
    </Suspense>
  );
}

async function GamesContent({ params }: Pick<PageProps<"/s/[id]/games">, "params">) {
  const { id } = await params;
  await requireUser(`/s/${encodeURIComponent(id)}/games`);
  const session = await getSession(id);
  if (!session) notFound();
  // Drafts have no games yet.
  if (session.status === "draft") redirect(`/s/${session.id}`);

  const [{ games, names }, standings, t] = await Promise.all([getMatchLog(session.id), getStandings(session.id), getT()]);
  const ended = session.status === "ended";

  return (
    <>
      {/* QA-01: no navigating away without signal. */}
      <OfflineNavGuard />
      <PageShell
        top={<BackLink href={`/s/${session.id}`} label={ended ? t.session.summaryTitle : t.nav.courts} />}
        eyebrow={session.name}
        title={t.games.pageTitle}
      >
        <GamesView sessionId={session.id} games={games} names={names} standings={standings ?? []} />
      </PageShell>
    </>
  );
}
