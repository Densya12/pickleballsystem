"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui";
import { CheckIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { canConfirmWinners, toggleWinner, winnersHint } from "@/lib/queue/winners";

type Props = {
  players: readonly { id: string; name: string }[];
  /** 2 in doubles, 1 in singles. */
  needed?: number;
  busy?: boolean;
  onConfirm: (winnerIds: string[]) => void;
  onCancel: () => void;
};

/** Winners stay (BR11): "Sino ang nanalo?" Tap the winner(s), then Kumpirmahin. */
export function WinnerPicker({ players, needed = 2, busy, onConfirm, onCancel }: Props) {
  const [picked, setPicked] = useState<string[]>([]);
  const id = useId();

  return (
    <div role="group" aria-labelledby={`${id}-q`} aria-describedby={`${id}-hint`} className="flex flex-col gap-3 rounded-control border-[1.5px] border-ink bg-surface p-4">
      <p id={`${id}-q`} className="text-lg font-semibold">
        Sino ang nanalo?
      </p>
      <p id={`${id}-hint`} className="-mt-2 text-muted" aria-live="polite">
        {winnersHint(picked, needed)}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {players.map((player) => {
          const on = picked.includes(player.id);
          return (
            <button
              key={player.id}
              type="button"
              aria-pressed={on}
              onClick={() => setPicked((current) => toggleWinner(current, player.id, needed))}
              className={cn(
                "flex min-h-14 items-center gap-2 rounded-control border-[1.5px] bg-surface px-3 py-2 text-left font-semibold",
                "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus",
                on ? "border-ink bg-accent-soft" : "border-strong",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px]",
                  on ? "border-ink bg-primary text-on-primary" : "border-strong",
                )}
              >
                {on && <CheckIcon className="size-4" />}
              </span>
              <span className="min-w-0 [overflow-wrap:anywhere]">{player.name}</span>
            </button>
          );
        })}
      </div>
      <Button fullWidth disabled={busy || !canConfirmWinners(picked, needed)} onClick={() => onConfirm(picked)}>
        {busy ? "Sine-save…" : "Kumpirmahin"}
      </Button>
      <Button variant="secondary" fullWidth disabled={busy} onClick={onCancel}>
        Huwag muna
      </Button>
    </div>
  );
}
