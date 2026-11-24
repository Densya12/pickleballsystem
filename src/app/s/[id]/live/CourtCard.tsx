"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import type { LiveCourt } from "@/lib/queue/data";
import { needPlayersText } from "@/lib/queue/messages";
import { WinnerPicker } from "./WinnerPicker";

type Props = {
  court: LiveCourt;
  rotation: string;
  eligibleCount: number;
  busy: boolean;
  onCall: (courtId: string) => void;
  onFinish: (courtId: string, gameId: string, winnerIds: string[] | null) => void;
};

/** One court: the 4 names in a 2×2 grid (no "VS": they pick partners on court, D11). */
export function CourtCard({ court, rotation, eligibleCount, busy, onCall, onFinish }: Props) {
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
                className="flex min-h-14 items-center rounded-control bg-primary-tint px-3 py-2 font-semibold [overflow-wrap:anywhere]"
              >
                {player.name}
              </li>
            ))}
          </ul>
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
