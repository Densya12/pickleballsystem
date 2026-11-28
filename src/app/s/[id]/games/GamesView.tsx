"use client";

import { useState, useTransition } from "react";
import { chipLabels } from "@/components/court/MiniCourt";
import { StandingsTable } from "@/components/games/StandingsTable";
import { BottomSheet, Button, EmptyState, ListGroup, Notice, RadioGroup, Section } from "@/components/ui";
import { partnerChoices, winnersOf, winningSide, withPartner, type LogGame, type StandingRow } from "@/lib/games/log";
import { useLocale, useT } from "@/lib/i18n/client";
import { isNetworkError } from "@/lib/outbox/rules";
import { teamsOf } from "@/lib/queue/winners";
import { useSessionSync } from "@/lib/realtime/useSessionSync";
import { formatTime } from "@/lib/session/time";
import { correctGameAction } from "../_lib/games-actions";

type Side = "left" | "right" | "none";

/**
 * Games & standings (D27), for staff: the match log (finished games, newest
 * first) with Correct on each, and the standings. Updates live (NF9).
 */
export function GamesView({
  sessionId,
  games,
  names,
  standings,
}: {
  sessionId: string;
  games: LogGame[];
  /** Every player's name, players who left too. */
  names: Record<string, string>;
  standings: StandingRow[];
}) {
  const t = useT();
  const locale = useLocale();
  const sync = useSessionSync(sessionId);
  const [editing, setEditing] = useState<LogGame | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Short labels (first names unless two clash), as on the court chips.
  const ids = Object.keys(names);
  const labels = chipLabels(ids.map((id) => names[id]));
  const label = (id: string) => labels[ids.indexOf(id)] ?? names[id] ?? "?";
  const team = (side: readonly string[]) => side.map(label).join(" + ");

  return (
    <div className="flex flex-col gap-5" data-live-sync={sync}>
      <div className="flex flex-col gap-2 empty:hidden" aria-live="polite">
        {sync === "lost" && <Notice kind="error">{t.live.connectionLost}</Notice>}
        {error && <Notice kind="error">{error}</Notice>}
        {banner && <Notice kind="success">{banner}</Notice>}
      </div>

      <Section id="match-log" label={t.games.logTitle}>
        {games.length === 0 ? (
          <EmptyState>{t.games.noGames}</EmptyState>
        ) : (
          <ListGroup>
            {games.map((game) => {
              const [left, right] = teamsOf(game.playerIds, game.format);
              const won = winningSide(game.playerIds, game.winnerIds, game.format);
              return (
                <li key={game.id} aria-label={t.games.gameLine(game.number, game.courtLabel, formatTime(new Date(game.startedAt), locale))} className="flex items-center gap-3 px-4 py-3" data-game={game.number}>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm text-muted">{t.games.gameLine(game.number, game.courtLabel, formatTime(new Date(game.startedAt), locale))}</span>
                    <span className="font-medium [overflow-wrap:anywhere]">{t.games.versus(team(left), team(right))}</span>
                    <span className={won === null ? "text-sm text-muted" : "text-sm font-medium text-secondary"} data-testid="result">
                      {won === null ? t.games.noResult : t.games.won((won === 0 ? left : right).map(label))}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    // D27: a 48px tap area on a compact button.
                    className="shrink-0 after:min-h-12 after:min-w-12"
                    aria-label={t.games.correctGame(game.number)}
                    onClick={() => {
                      setBanner(null);
                      setError(null);
                      setEditing(game);
                    }}
                  >
                    {t.games.correct}
                  </Button>
                </li>
              );
            })}
          </ListGroup>
        )}
      </Section>

      <Section id="standings" label={t.games.standingsTitle}>
        <p className="mx-1 -mt-0.5 mb-2 text-sm text-muted">{t.games.standingsHint}</p>
        <StandingsTable rows={standings} />
      </Section>

      {editing && (
        <CorrectSheet
          key={editing.id}
          game={editing}
          label={label}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null);
            setError(null);
            setBanner(text);
          }}
          onError={(text) => {
            setBanner(null);
            setError(text);
          }}
          sessionId={sessionId}
        />
      )}
    </div>
  );
}

/** Correct one game: the result, and (doubles) Player 1's partner. Same players only. */
function CorrectSheet({
  sessionId,
  game,
  label,
  onClose,
  onSaved,
  onError,
}: {
  sessionId: string;
  game: LogGame;
  label: (id: string) => string;
  onClose: () => void;
  onSaved: (banner: string) => void;
  onError: (message: string) => void;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const doubles = game.format === "doubles";
  const [partner, setPartner] = useState(game.playerIds[1]);
  const order = doubles ? withPartner(game.playerIds, partner) : game.playerIds;
  const [left, right] = teamsOf(order, game.format);
  // The result follows the winners, even when the teams change (they keep their side only if they're still a side).
  const current = winningSide(order, game.winnerIds, game.format);
  const [side, setSide] = useState<Side>(current === 0 ? "left" : current === 1 ? "right" : "none");
  const team = (ids: readonly string[]) => ids.map(label).join(" + ");

  function save() {
    const winners = winnersOf(order, side === "left" ? 0 : side === "right" ? 1 : null, game.format);
    startTransition(async () => {
      try {
        const result = await correctGameAction(sessionId, game.id, order, winners);
        if (result.error) onError(result.error);
        else onSaved(result.banner ?? t.games.fixed);
      } catch (caught) {
        if (!isNetworkError(caught)) throw caught;
        onError(t.live.onlineOnly);
      }
    });
  }

  return (
    <BottomSheet open onClose={onClose} title={t.games.correctTitle(game.number)} subtitle={t.games.correctSubtitle}>
      <div className="flex flex-col gap-4 rounded-group bg-surface p-4">
        {doubles && (
          <RadioGroup
            legend={`${t.games.fixTeams} · ${t.games.partnerOf(label(game.playerIds[0]))}`}
            name="partner"
            look="chips"
            options={partnerChoices(game.playerIds).map((id) => ({ value: id, label: label(id) }))}
            value={partner}
            onValueChange={(value) => {
              setPartner(value);
              // The same winners, on their new side if they still are one; otherwise no result until chosen.
              const next = winningSide(withPartner(game.playerIds, value), game.winnerIds, game.format);
              setSide(next === 0 ? "left" : next === 1 ? "right" : "none");
            }}
          />
        )}
        <RadioGroup
          legend={t.games.result}
          name="result"
          options={[
            { value: "left", label: t.games.leftWon, description: team(left) },
            { value: "right", label: t.games.rightWon, description: team(right) },
            { value: "none", label: t.games.noResultChoice },
          ]}
          value={side}
          onValueChange={setSide}
        />
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" size="md" className="flex-1" disabled={pending} onClick={onClose}>
          {t.common.cancel}
        </Button>
        <Button size="md" className="flex-1" disabled={pending} onClick={save}>
          {pending ? t.common.saving : t.common.save}
        </Button>
      </div>
    </BottomSheet>
  );
}
