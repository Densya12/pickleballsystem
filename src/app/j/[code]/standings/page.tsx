import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PlayerStandingsSkeleton } from "@/components/skeletons/PlayerSkeletons";
import { getStandings } from "@/lib/games/data";
import { en } from "@/lib/i18n/dictionary";
import { getPlayerSessionView } from "@/lib/player/data";
import { normalizeJoinCode } from "@/lib/queue/qr";
import { StandingsView } from "./StandingsView";

export const metadata: Metadata = {
  title: en.games.standingsTitle,
};

/** Standings for players (D27): read-only, live or after the session ends. */
export default function StandingsPage({ params }: PageProps<"/j/[code]/standings">) {
  return (
    <Suspense fallback={<PlayerStandingsSkeleton />}>
      <StandingsContent params={params} />
    </Suspense>
  );
}

async function StandingsContent({ params }: Pick<PageProps<"/j/[code]/standings">, "params">) {
  const code = normalizeJoinCode((await params).code);
  if (!code) redirect("/j/invalid");

  // RLS and session_standings: players of this session (also after it ends) and its staff.
  const view = await getPlayerSessionView(code);
  if (!view) redirect(`/j/${code}`);
  const rows = await getStandings(view.session.id);
  if (!rows) redirect(`/j/${code}/me`);

  return <StandingsView code={code} sessionId={view.session.id} sessionName={view.session.name} meId={view.me?.id ?? null} rows={rows} />;
}
