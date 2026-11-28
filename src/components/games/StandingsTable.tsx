"use client";

import { EmptyState } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import type { StandingRow } from "@/lib/games/log";

/**
 * Standings (D27): rank, name, W, L, games. The database orders them (wins
 * desc, losses asc, name) and ties share a rank. Read-only; `meId` marks the
 * player's own row on their phone.
 */
export function StandingsTable({ rows, meId = null }: { rows: readonly StandingRow[]; meId?: string | null }) {
  const t = useT();
  if (rows.length === 0) return <EmptyState>{t.games.noStandings}</EmptyState>;
  const num = "w-10 px-1 py-3 text-right tabular-nums";
  return (
    <div className="overflow-hidden rounded-group bg-surface">
      <table className="w-full border-collapse text-body" data-testid="standings">
        <thead>
          <tr className="border-b border-hairline text-left text-sm text-muted">
            <th scope="col" className="w-12 py-2.5 pl-4 font-medium">
              <abbr title={t.games.colRank} className="no-underline">#</abbr>
            </th>
            <th scope="col" className="py-2.5 pr-2 font-medium">
              {t.games.colName}
            </th>
            <th scope="col" className="w-10 px-1 py-2.5 text-right font-medium">
              <abbr title={t.games.colWinsFull} className="no-underline">{t.games.colWins}</abbr>
            </th>
            <th scope="col" className="w-10 px-1 py-2.5 text-right font-medium">
              <abbr title={t.games.colLossesFull} className="no-underline">{t.games.colLosses}</abbr>
            </th>
            <th scope="col" className="py-2.5 pr-4 pl-1 text-right font-medium">
              {t.games.colGames}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.map((row) => {
            const me = row.playerId === meId;
            return (
              <tr key={row.playerId} className={cn(me && "bg-accent-faint")} data-me={me || undefined}>
                <td className="py-3 pl-4 text-muted tabular-nums">{row.rank}</td>
                <th scope="row" className="py-3 pr-2 text-left font-medium [overflow-wrap:anywhere]">
                  {row.name}
                  {me && <span className="ml-1.5 text-sm font-normal text-muted">· {t.games.you}</span>}
                </th>
                <td className={cn(num, "font-semibold")}>{row.wins}</td>
                <td className={num}>{row.losses}</td>
                <td className="py-3 pr-4 pl-1 text-right text-muted tabular-nums">{row.games}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
