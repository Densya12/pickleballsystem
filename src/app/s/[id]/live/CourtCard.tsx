"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { AlertIcon } from "@/components/ui/icons";
import type { LiveCourt } from "@/lib/queue/data";
import { needPlayersText, notReadyText } from "@/lib/queue/messages";
import { WinnerPicker } from "./WinnerPicker";

type Props = {
  court: LiveCourt;
  rotation: string;
  eligibleCount: number;
  busy: boolean;
  onCall: (courtId: string) => void;
  onFinish: (courtId: string, gameId: string, winnerIds: string[] | null) => void;
  /** BR19: replace a player who said "Hindi pa ako handa". */
  onSwap: (courtId: string, playerId: string) => void;
};

/** One court: the 4 names in a 2×2 grid (no "VS": they pick partners on court, D11). */
export function CourtCard({ court, rotation, eligibleCount, busy, onCall, onFinish, onSwap }: Props) {
  const [picking, setPicking] = useState(false);
  const game = court.game;
  const headingId = `court-${court.id}`;

  return (
    <Card className="flex flex-col gap-4" aria-labelledby={headingId} role="region">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={headingId} className="text-xl">
          {court.label}
        </h3>
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
      ) : eligibleCount >= 4 ? (
        <Button size="lg" variant="accent" fullWidth disabled={busy} onClick={() => onCall(court.id)}>
          Tawagin ang susunod
        </Button>
      ) : (
        <p className="rounded-control bg-subtle px-4 py-3 text-center font-semibold">
          {needPlayersText(4 - eligibleCount)}
        </p>
      )}
    </Card>
  );
}
