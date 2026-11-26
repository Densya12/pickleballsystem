"use client";

import { useId } from "react";
import { Button } from "@/components/ui";
import { chipLabels } from "@/components/court/MiniCourt";
import { useT } from "@/lib/i18n/client";
import { teamsOf } from "@/lib/queue/winners";

type Props = {
  /** The game's players in position order: team 1 (left) first. */
  players: { id: string; name: string }[];
  format: string;
  /** "Skip (no winner)": every rotation except Winners stay, where a winner is required. */
  allowSkip: boolean;
  busy: boolean;
  /** The winning side's players, or null for Skip. */
  onPick: (winnerIds: string[] | null) => void;
  onCancel: () => void;
};

/**
 * "Who won?" (D25): one tap on a side ("Ana + Ben won"), in every preset and
 * rotation. The sides match the mini court: team 1 on the left. The winners
 * stored are that side's players.
 */
export function WinnerPicker({ players, format, allowSkip, busy, onPick, onCancel }: Props) {
  const t = useT();
  const id = useId();
  const labels = chipLabels(players.map((p) => p.name));
  const named = players.map((p, i) => ({ ...p, label: labels[i] }));
  const [left, right] = teamsOf(named, format);

  return (
    <div role="group" aria-labelledby={`${id}-q`} aria-describedby={`${id}-hint`} className="flex flex-col gap-2.5 rounded-control bg-info p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p id={`${id}-q`} className="font-semibold">
          {t.live.whoWon}
        </p>
        <p id={`${id}-hint`} className="text-sm text-muted">
          {t.live.whoWonHint}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[left, right].map((side, index) => (
          <button
            key={index}
            type="button"
            disabled={busy}
            data-side={index === 0 ? "left" : "right"}
            onClick={() => onPick(side.map((p) => p.id))}
            className="flex min-h-12 flex-col items-start justify-center rounded-control border border-quiet bg-surface px-3 py-2 text-left hover:bg-accent-faint focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-50"
          >
            <span className="text-xs text-muted">{index === 0 ? t.live.leftSide : t.live.rightSide}</span>
            <span className="font-semibold [overflow-wrap:anywhere]">{t.live.sideWon(side.map((p) => p.label))}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" size="pill" className="flex-1" disabled={busy} onClick={onCancel}>
          {t.common.cancel}
        </Button>
        {allowSkip && (
          <Button variant="outline" size="pill" className="flex-1" disabled={busy} onClick={() => onPick(null)}>
            {t.live.skipWinner}
          </Button>
        )}
      </div>
    </div>
  );
}
