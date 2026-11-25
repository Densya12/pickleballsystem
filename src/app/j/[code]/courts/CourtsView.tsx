"use client";

import { MiniCourt } from "@/components/court/MiniCourt";
import { LanguageSwitch } from "@/components/i18n/LanguageSwitch";
import { BackLink, Button, EmptyState, ListGroup, Notice, PageShell, Section, StatusChip } from "@/components/ui";
import { BellIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { courtCards, courtsLineup, type LineupPlayer } from "@/lib/player/courts";
import type { PlayerSessionView } from "@/lib/player/data";
import { callSizeFor, pickPwestoState } from "@/lib/player/state";
import { useCalledAlert } from "@/lib/player/useCalledAlert";
import { useScreenWakeLock } from "@/lib/player/useScreenWakeLock";
import { useSessionSync } from "@/lib/realtime/useSessionSync";
import { courtFormatLabel } from "@/lib/session/validation";

/** Courts for players (D14, BR21): who is playing and who is next. Updates live (NF9). */
export function CourtsView({ code, view }: { code: string; view: PlayerSessionView }) {
  const t = useT();
  const sync = useSessionSync(view.session.id);
  const meId = view.me?.id ?? null;
  const state = pickPwestoState({
    sessionStatus: view.session.status,
    me: view.me,
    players: view.players,
    games: view.games,
    callSize: callSizeFor(view.courtFormats),
    rules: view.rules,
  });

  // Called while looking at the courts: the same alert as on My place.
  const { acked, acknowledge } = useCalledAlert(state.kind === "playing" ? state.gameId : null);
  const wakeLock = useScreenWakeLock(state.kind === "queued" || state.kind === "playing");

  const cards = courtCards(view.courts, view.courtGames, view.players);
  const lineup = courtsLineup(view.players, view.courtFormats, view.rules);

  return (
    <PageShell
      top={
        <>
          <BackLink href={`/j/${code}/me`} label={t.player.backToPlace} />
          <LanguageSwitch />
        </>
      }
      eyebrow={view.session.name}
      title={t.player.courtsTitle}
    >
      <div className="flex flex-col gap-5" data-live-sync={sync} data-state={state.kind}>
        {sync === "lost" && <Notice kind="error">{t.live.connectionLost}</Notice>}

        {state.kind === "playing" && !acked && (
          <div role="alert" className="flex flex-col gap-3 rounded-card bg-primary p-4 text-on-primary">
            <p className="inline-flex items-center gap-2 self-start rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent">
              <BellIcon className="size-3.5" />
              {t.player.youreUp}
            </p>
            <p className="font-display text-2xl font-semibold">
              {t.player.yourTurn(view.me?.name.split(/\s+/)[0] ?? "")} {t.player.headTo} <span className="text-accent">{state.courtLabel}</span>
            </p>
            <Button variant="lime" size="lg" fullWidth onClick={acknowledge}>
              {t.player.onMyWay}
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          {cards.map((card) => (
            <section key={card.id} aria-labelledby={`court-${card.id}`} className="flex flex-col gap-2.5 rounded-card bg-surface p-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id={`court-${card.id}`} className="text-base font-semibold">
                  {card.label}
                </h2>
                <span className="text-xs text-muted">
                  {courtFormatLabel(card.format, t)}
                  {card.game ? ` · #${card.game.number}` : ` · ${t.live.empty}`}
                </span>
              </div>
              <MiniCourt format={card.format} players={(card.game?.players ?? []).map((p) => ({ ...p, highlight: p.id === meId }))} />
              {card.game ? (
                <ul aria-label={t.live.playingOn(card.label)} className="sr-only">
                  {card.game.players.map((player) => (
                    <li key={player.id}>{player.id === meId ? `${player.name} (${t.player.you})` : player.name}</li>
                  ))}
                </ul>
              ) : (
                <p className="sr-only">{t.live.empty}</p>
              )}
            </section>
          ))}
        </div>

        <Section id="get-ready" label={t.player.getReady}>
          {lineup.ready.length > 0 ? <NameList players={lineup.ready} meId={meId} /> : <EmptyState>{t.player.nobodyWaiting}</EmptyState>}
          <p className="mx-1 mt-2 text-xs text-muted">{t.player.getReadyHint}</p>
        </Section>

        {lineup.after.length > 0 && (
          <Section id="after-them" label={t.player.afterThem}>
            <NameList players={lineup.after} meId={meId} start={lineup.ready.length + 1} />
          </Section>
        )}

        {lineup.notCallable.length > 0 && (
          <Section id="on-hold" label={t.player.notCallable}>
            <ListGroup>
              {lineup.notCallable.map((player) => (
                <li key={player.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <PlayerName player={player} meId={meId} />
                  <StatusChip kind={player.reason} />
                </li>
              ))}
            </ListGroup>
          </Section>
        )}

        {!wakeLock.supported && (state.kind === "queued" || state.kind === "playing") && (
          <p className="px-6 text-center text-xs text-muted">{t.player.keepScreenOn}</p>
        )}
      </div>
    </PageShell>
  );
}

/** The player's own name is marked "You" (text, not color alone). */
function PlayerName({ player, meId }: { player: LineupPlayer; meId: string | null }) {
  const t = useT();
  const isMe = player.id === meId;
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-medium" data-me={isMe || undefined}>
      <span className="[overflow-wrap:anywhere]">{player.name}</span>
      {isMe && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-on-accent">{t.player.you}</span>}
    </span>
  );
}

function NameList({ players, meId, start = 1 }: { players: LineupPlayer[]; meId: string | null; start?: number }) {
  return (
    <ol className="divide-y divide-hairline overflow-hidden rounded-group bg-surface">
      {players.map((player, index) => (
        <li key={player.id} className={cn("flex items-center gap-3 px-4 py-[11px]", player.id === meId && "bg-accent-faint")}>
          <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-subtle text-sm font-semibold">
            <span className="sr-only">#</span>
            {start + index}
          </span>
          <PlayerName player={player} meId={meId} />
        </li>
      ))}
    </ol>
  );
}
