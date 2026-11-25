"use client";

import { useState } from "react";
import { MiniCourt } from "@/components/court/MiniCourt";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import type { LiveCourt } from "@/lib/queue/data";
import { winnersFor } from "@/lib/queue/winners";
import { minutesSince } from "@/lib/session/time";
import { courtFormatLabel, courtSize } from "@/lib/session/validation";
import { WinnerPicker } from "./WinnerPicker";

type Format = "doubles" | "singles";

type Props = {
  court: LiveCourt;
  rotation: string;
  eligibleCount: number;
  now: number;
  busy: boolean;
  /** An action for this court is waiting for signal (NF10). */
  waiting?: boolean;
  onCall: (courtId: string) => void;
  /** "Need N more": the button stays tappable and explains. */
  onNeedMore: (needed: number) => void;
  onFinish: (courtId: string, gameId: string, winnerIds: string[] | null) => void;
  /** BR19: replace a player who said they aren't ready. */
  onSwap: (courtId: string, playerId: string) => void;
  /** Doubles <-> singles while the court is empty. */
  onSetFormat: (courtId: string, format: Format) => void;
};

/**
 * One court (D19): a mini court with the players' names in their service
 * boxes, the minutes since the game started, and the court's actions.
 */
export function CourtCard({ court, rotation, eligibleCount, now, busy: actionBusy, waiting = false, onCall, onNeedMore, onFinish, onSwap, onSetFormat }: Props) {
  const t = useT();
  const [picking, setPicking] = useState(false);
  const [confirmFormat, setConfirmFormat] = useState(false);
  const busy = actionBusy || waiting;
  const game = court.game;
  const headingId = `court-${court.id}`;
  const size = courtSize(court.format);
  const formatLabel = courtFormatLabel(court.format, t);
  const otherFormat: Format = court.format === "singles" ? "doubles" : "singles";
  const otherLabel = courtFormatLabel(otherFormat, t);
  const notReady = game?.players.filter((p) => p.notReady) ?? [];

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2.5 rounded-card bg-surface p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={headingId} className="text-lg font-semibold">
          {court.label}
        </h2>
        <span className="text-xs text-muted">
          {t.live.courtMeta(formatLabel, game ? minutesSince(game.startedAt, now) : null)}
        </span>
      </div>

      <MiniCourt
        format={court.format}
        players={(game?.players ?? []).map((p) => ({ id: p.id, name: p.name, notReady: p.notReady }))}
      />
      {game ? (
        <ul className="sr-only" aria-label={t.live.playingOn(court.label)}>
          {game.players.map((player) => (
            <li key={player.id}>{player.notReady ? `${player.name}, ${t.status.notReady}` : player.name}</li>
          ))}
        </ul>
      ) : (
        <p className="sr-only">{t.live.empty}</p>
      )}

      {waiting && <p className="rounded-control bg-info px-3 py-2 text-sm font-medium">{t.live.waitingForSignal(1).replace(/\s*\(\d+\)$/, "")}</p>}

      {game ? (
        picking ? (
          <WinnerPicker
            players={game.players}
            needed={winnersFor(game.format)}
            busy={busy}
            onConfirm={(winners) => {
              setPicking(false);
              onFinish(court.id, game.id, winners);
            }}
            onCancel={() => setPicking(false)}
          />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-col items-start">
              {notReady.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onSwap(court.id, player.id)}
                  className="touch-target min-h-10 text-left text-sm font-medium text-warn disabled:opacity-50"
                >
                  {t.live.notReadySwap(player.name.split(/\s+/)[0] ?? player.name)}
                </button>
              ))}
            </div>
            <Button
              variant="lime"
              size="pill"
              className="ml-auto px-[22px]"
              aria-label={t.live.doneOn(court.label)}
              disabled={busy}
              onClick={() => (rotation === "winners_stay" ? setPicking(true) : onFinish(court.id, game.id, null))}
            >
              {t.live.done}
            </Button>
          </div>
        )
      ) : confirmFormat ? (
        <div role="group" aria-label={t.live.makeFormatQuestion(court.label, otherLabel)} className="flex flex-col gap-2 rounded-control bg-info p-3">
          <p className="text-sm font-medium">{t.live.makeFormatQuestion(court.label, otherLabel)}</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="pill" className="flex-1" disabled={busy} onClick={() => setConfirmFormat(false)}>
              {t.common.cancel}
            </Button>
            <Button
              size="pill"
              className="flex-1"
              disabled={busy}
              onClick={() => {
                setConfirmFormat(false);
                onSetFormat(court.id, otherFormat);
              }}
            >
              {t.live.yesMake(otherLabel)}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" className="-ml-2 font-medium" disabled={busy} onClick={() => setConfirmFormat(true)}>
            {t.live.makeFormat(otherLabel)}
          </Button>
          {eligibleCount >= size ? (
            <Button variant="lime" size="pill" disabled={busy} onClick={() => onCall(court.id)}>
              {t.live.callNext(size)}
            </Button>
          ) : (
            <Button variant="outline" size="pill" className="text-muted" disabled={busy} onClick={() => onNeedMore(size - eligibleCount)}>
              {t.live.needMore(size - eligibleCount)}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
