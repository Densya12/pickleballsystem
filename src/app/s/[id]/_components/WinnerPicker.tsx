"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui";
import { CheckIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import { canConfirmWinners, toggleWinner, winnersHint } from "@/lib/queue/winners";

type Props = {
  players: { id: string; name: string }[];
  /** 2 in doubles, 1 in singles. */
  needed: number;
  busy: boolean;
  onConfirm: (winnerIds: string[]) => void;
  onCancel: () => void;
};

/** Winners stay (BR11): tap the winners, then Confirm. */
export function WinnerPicker({ players, needed, busy, onConfirm, onCancel }: Props) {
  const t = useT();
  const [picked, setPicked] = useState<string[]>([]);
  const id = useId();

  return (
    <div role="group" aria-labelledby={`${id}-q`} aria-describedby={`${id}-hint`} className="flex flex-col gap-2.5 rounded-control bg-info p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p id={`${id}-q`} className="font-semibold">
          {t.live.whoWon}
        </p>
        <p id={`${id}-hint`} className="text-sm text-muted" aria-live="polite">
          {winnersHint(picked, needed, t)}
        </p>
      </div>
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
                "flex min-h-11 items-center gap-2 rounded-full border px-3 text-left text-sm font-medium",
                on ? "border-ink bg-primary text-on-primary" : "border-input bg-surface text-ink",
              )}
            >
              {on && <CheckIcon className="size-4 shrink-0" />}
              <span className="min-w-0 [overflow-wrap:anywhere]">{player.name}</span>
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" size="pill" className="flex-1" disabled={busy} onClick={onCancel}>
          {t.common.cancel}
        </Button>
        <Button size="pill" className="flex-1" disabled={busy || !canConfirmWinners(picked, needed)} onClick={() => onConfirm(picked)}>
          {busy ? t.common.saving : t.live.confirm}
        </Button>
      </div>
    </div>
  );
}
