"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { AlertIcon } from "@/components/ui/icons";
import type { LiveCourt } from "@/lib/queue/data";
import { needPlayersText, notReadyText } from "@/lib/queue/messages";
import { winnersFor } from "@/lib/queue/winners";
import { courtFormatLabel, courtSize } from "@/lib/session/validation";
import { WinnerPicker } from "./WinnerPicker";

type Format = "doubles" | "singles";

type Props = {
  court: LiveCourt;
  rotation: string;
  eligibleCount: number;
  busy: boolean;
  onCall: (courtId: string) => void;
  onFinish: (courtId: string, gameId: string, winnerIds: string[] | null) => void;
  /** BR19: replace a player who said "Hindi pa ako handa". */
  onSwap: (courtId: string, playerId: string) => void;
  /** Doubles <-> singles while the court is empty. */
  onSetFormat: (courtId: string, format: Format) => void;
};

/**
 * One court: its format, and the players in a grid (4 in doubles, 2 in
 * singles). No "VS": doubles players pick partners on court (D11).
 */
export function CourtCard({ court, rotation, eligibleCount, busy, onCall, onFinish, onSwap, onSetFormat }: Props) {
  const [picking, setPicking] = useState(false);
  const [confirmFormat, setConfirmFormat] = useState(false);
  const game = court.game;
  const headingId = `court-${court.id}`;
  const size = courtSize(court.format);
  const otherFormat: Format = court.format === "singles" ? "doubles" : "singles";

  return (
    <Card className="flex flex-col gap-4" aria-labelledby={headingId} role="region">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h3 id={headingId} className="text-xl">
            {court.label}
          </h3>
          <span className="rounded-full border border-default bg-subtle px-2.5 py-0.5 text-sm font-semibold">
            {courtFormatLabel(court.format)}
          </span>
        </div>
        <p className="text-muted">{game ? `Laro #${game.number}` : "Bakante"}</p>
      </div>

      {game ? (
        <>
          <ul className="grid grid-cols-2 gap-2" aria-label={`Naglalaro sa ${court.label}`}>
            {game.players.map((player) => (
              <li
                key={player.id}
                className={
                  player.notReady
                    ? "flex min-h-14 flex-col justify-center rounded-control border-[1.5px] border-dashed border-ink bg-warn px-3 py-2 font-semibold [overflow-wrap:anywhere]"
                    : "flex min-h-14 items-center rounded-control bg-primary-tint px-3 py-2 font-semibold [overflow-wrap:anywhere]"
                }
              >
                {player.name}
                {player.notReady && <span className="text-sm font-semibold text-warn">Hindi pa handa</span>}
              </li>
            ))}
          </ul>
          {game.players
            .filter((player) => player.notReady)
            .map((player) => (
              <div key={player.id} className="flex flex-col gap-2 rounded-control bg-warn px-4 py-3">
                <p className="flex items-start gap-2 font-semibold text-warn">
                  <AlertIcon className="mt-0.5 size-5 shrink-0" />
                  <span>{notReadyText(player.name)}</span>
                </p>
                <Button variant="secondary" fullWidth disabled={busy} onClick={() => onSwap(court.id, player.id)}>
                  Palitan
                </Button>
              </div>
            ))}
          {picking ? (
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
            <Button
              size="lg"
              fullWidth
              disabled={busy}
              onClick={() => (rotation === "winners_stay" ? setPicking(true) : onFinish(court.id, game.id, null))}
            >
              Tapos na · tawagin ang susunod
            </Button>
          )}
        </>
      ) : (
        <>
          {eligibleCount >= size ? (
            <Button size="lg" variant="accent" fullWidth disabled={busy} onClick={() => onCall(court.id)}>
              Tawagin ang susunod
            </Button>
          ) : (
            <p className="rounded-control bg-subtle px-4 py-3 text-center font-semibold">
              {needPlayersText(size - eligibleCount)}
            </p>
          )}
          {confirmFormat ? (
            <div
              role="group"
              aria-label={`Gawing ${courtFormatLabel(otherFormat)} ang ${court.label}?`}
              className="flex flex-col gap-2 rounded-control border-[1.5px] border-ink bg-surface p-4"
            >
              <p className="font-semibold">
                Gawing {courtFormatLabel(otherFormat)} ang {court.label}?
              </p>
              <Button
                fullWidth
                disabled={busy}
                onClick={() => {
                  setConfirmFormat(false);
                  onSetFormat(court.id, otherFormat);
                }}
              >
                Oo, gawing {courtFormatLabel(otherFormat)}
              </Button>
              <Button variant="secondary" fullWidth disabled={busy} onClick={() => setConfirmFormat(false)}>
                Huwag
              </Button>
            </div>
          ) : (
            <Button variant="secondary" fullWidth disabled={busy} onClick={() => setConfirmFormat(true)}>
              Gawing {courtFormatLabel(otherFormat)}
            </Button>
          )}
        </>
      )}
    </Card>
  );
}
