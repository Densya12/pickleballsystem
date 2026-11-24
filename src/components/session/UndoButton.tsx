"use client";

import { useEffect, useState } from "react";
import { UndoIcon } from "@/components/ui/icons";
import { undoSecondsLeft } from "@/lib/undo/countdown";

type Props = {
  /** When the offer ends (ms since epoch). Remount (key) for a new offer. */
  deadline: number;
  onUndo: () => void;
  disabled?: boolean;
};

/** "Ibalik (28s)": counts down, then disappears. */
export function UndoButton({ deadline, onUndo, disabled }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const left = undoSecondsLeft(deadline, now);
  const expired = left === 0;

  useEffect(() => {
    if (expired) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [deadline, expired]);

  if (expired) return null;
  return (
    <button
      type="button"
      onClick={onUndo}
      disabled={disabled}
      className="inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-control border-[1.5px] border-ink bg-surface px-4 font-semibold text-ink hover:bg-subtle focus-visible:outline-3 focus-visible:outline-focus disabled:cursor-not-allowed disabled:text-muted"
    >
      <UndoIcon />
      <span>
        Ibalik <span className="tabular-nums">({left}s)</span>
      </span>
    </button>
  );
}
