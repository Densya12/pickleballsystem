"use client";

import { useEffect, useState } from "react";
import { UndoIcon } from "@/components/ui/icons";
import { useT } from "@/lib/i18n/client";
import { undoSecondsLeft } from "@/lib/undo/countdown";

type Props = {
  /** When the offer ends (ms since epoch). Remount (key) for a new offer. */
  deadline: number;
  onUndo: () => void;
  disabled?: boolean;
};

/** "Undo (28s)": counts down, then disappears. */
export function UndoButton({ deadline, onUndo, disabled }: Props) {
  const t = useT();
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
      className="touch-target inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 text-sm font-semibold text-on-primary tabular-nums disabled:opacity-50"
    >
      <UndoIcon className="size-4" />
      {t.live.undo(left)}
    </button>
  );
}
