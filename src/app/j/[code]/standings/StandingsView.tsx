"use client";

import { StandingsTable } from "@/components/games/StandingsTable";
import { LanguageSwitch } from "@/components/i18n/LanguageSwitch";
import { BackLink, Notice, PageShell } from "@/components/ui";
import type { StandingRow } from "@/lib/games/log";
import { useT } from "@/lib/i18n/client";
import { useSessionSync } from "@/lib/realtime/useSessionSync";

/** Standings for players (D27): read-only, updates live when a game finishes or is corrected (NF9). */
export function StandingsView({
  code,
  sessionId,
  sessionName,
  meId,
  rows,
}: {
  code: string;
  sessionId: string;
  sessionName: string;
  meId: string | null;
  rows: StandingRow[];
}) {
  const t = useT();
  const sync = useSessionSync(sessionId);
  return (
    <PageShell
      top={
        <>
          <BackLink href={`/j/${code}/me`} label={t.player.backToPlace} />
          <LanguageSwitch />
        </>
      }
      eyebrow={sessionName}
      title={t.games.standingsTitle}
    >
      <div className="flex flex-col gap-2" data-live-sync={sync}>
        {sync === "lost" && <Notice kind="error">{t.live.connectionLost}</Notice>}
        <p className="mx-1 text-sm text-muted">{t.games.standingsHint}</p>
        <StandingsTable rows={rows} meId={meId} />
      </div>
    </PageShell>
  );
}
