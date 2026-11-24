"use client";

import type { ReactNode } from "react";
import { BackLink, Button, Card, Notice, PageShell } from "@/components/ui";
import { courtCards, courtsLineup, type LineupPlayer } from "@/lib/player/courts";
import type { PlayerSessionView } from "@/lib/player/data";
import { callSizeFor, pickPwestoState } from "@/lib/player/state";
import { useCalledAlert } from "@/lib/player/useCalledAlert";
import { useScreenWakeLock } from "@/lib/player/useScreenWakeLock";
import { useSessionSync } from "@/lib/realtime/useSessionSync";
import { courtFormatLabel } from "@/lib/session/validation";
import { CalledBanner, KeepScreenOnNote } from "../me/CalledBanner";

/** Mga court (D14, BR21). Updates live (NF9), like Pwesto. */
export function CourtsView({ code, view }: { code: string; view: PlayerSessionView }) {
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

  // Called while looking at the courts: the same alert as on Pwesto.
  const { acked, acknowledge } = useCalledAlert(state.kind === "playing" ? state.gameId : null);
  const wakeLock = useScreenWakeLock(state.kind === "queued" || state.kind === "playing");

  const cards = courtCards(view.courts, view.courtGames, view.players);
  const lineup = courtsLineup(view.players, view.courtFormats, view.rules);

  return (
    <PageShell
      header={
        <div className="flex flex-col gap-1">
          <BackLink href={`/j/${code}/me`} label="Bumalik sa pwesto ko" />
          <p className="text-muted [overflow-wrap:anywhere]">{view.session.name}</p>
          <h1 className="text-3xl">Mga court</h1>
        </div>
      }
    >
      <div className="flex flex-col gap-6" data-live-sync={sync} data-state={state.kind}>
        {sync === "lost" && <Notice kind="error">Nawalan ng koneksyon. Sinusubukang kumonekta ulit…</Notice>}

        {state.kind === "playing" && !acked && (
          <div className="flex flex-col gap-3">
            <CalledBanner name={view.me?.name ?? ""} courtLabel={state.courtLabel} />
            <Button size="lg" fullWidth onClick={acknowledge}>
              Papunta na ako
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {cards.map((card) => (
            <Card key={card.id} role="region" aria-labelledby={`court-${card.id}`} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 id={`court-${card.id}`} className="text-2xl">
                  {card.label}
                </h2>
                <p className="text-muted">
                  {courtFormatLabel(card.format)}
                  {card.game && ` · Laro #${card.game.number}`}
                </p>
              </div>
              {card.game ? (
                <ul aria-label={`Naglalaro sa ${card.label}`} className="grid grid-cols-2 gap-2">
                  {card.game.players.map((player) => (
                    <li key={player.id} className="rounded-control bg-primary-tint px-3 py-3 font-semibold">
                      <PlayerName player={player} meId={meId} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-control border border-dashed border-strong px-3 py-3 font-semibold text-muted">
                  Bakante
                </p>
              )}
            </Card>
          ))}
        </div>

        <Section id="ready" title="Maghanda na" hint="Sila ang tatawagin sa susunod na bakanteng court.">
          {lineup.ready.length > 0 ? (
            <NameList players={lineup.ready} meId={meId} ordered />
          ) : (
            <Empty>Wala pang nakapila.</Empty>
          )}
        </Section>

        {lineup.after.length > 0 && (
          <Section id="after" title="Susunod pagkatapos">
            <NameList players={lineup.after} meId={meId} ordered />
          </Section>
        )}

        {lineup.notCallable.length > 0 && (
          <Section id="waiting" title="Hindi pa matatawag">
            <ul className="flex flex-col divide-y divide-default rounded-card border border-default bg-surface">
              {lineup.notCallable.map((player) => (
                <li key={player.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0 font-semibold">
                    <PlayerName player={player} meId={meId} />
                  </span>
                  <span className="shrink-0 rounded-full bg-warn px-2.5 py-1 text-sm font-semibold text-warn">
                    {player.reason}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {!wakeLock.supported && (state.kind === "queued" || state.kind === "playing") && <KeepScreenOnNote />}
      </div>
    </PageShell>
  );
}

/** The player's own name is marked "Ikaw" (text, not color alone). */
function PlayerName({ player, meId }: { player: LineupPlayer; meId: string | null }) {
  const isMe = player.id === meId;
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1" data-me={isMe || undefined}>
      <span className={isMe ? "[overflow-wrap:anywhere] underline decoration-2 underline-offset-4" : "[overflow-wrap:anywhere]"}>
        {player.name}
      </span>
      {isMe && <span className="rounded-full bg-primary px-2 py-0.5 text-sm font-bold text-on-primary">Ikaw</span>}
    </span>
  );
}

function NameList({ players, meId, ordered }: { players: LineupPlayer[]; meId: string | null; ordered?: boolean }) {
  const List = ordered ? "ol" : "ul";
  return (
    <List className="flex flex-col divide-y divide-default rounded-card border border-default bg-surface">
      {players.map((player, index) => (
        <li key={player.id} className="flex items-center gap-3 px-4 py-3 font-semibold">
          {ordered && (
            <span className="font-display text-muted">
              <span className="sr-only">Pang-</span>
              {index + 1}.
            </span>
          )}
          <PlayerName player={player} meId={meId} />
        </li>
      ))}
    </List>
  );
}

function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-2">
      <h2 id={`${id}-heading`} className="text-2xl">
        {title}
      </h2>
      {hint && <p className="text-muted">{hint}</p>}
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-card border border-dashed border-strong px-5 py-4 text-muted">{children}</p>;
}
