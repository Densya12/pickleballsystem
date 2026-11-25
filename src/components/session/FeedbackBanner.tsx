"use client";

import { IconButton } from "@/components/ui";
import { CheckIcon, CloseIcon } from "@/components/ui/icons";
import { useT } from "@/lib/i18n/client";
import { UndoButton } from "./UndoButton";

export type UndoOffer = {
  deadline: number;
  /** Shown once the undo succeeds. */
  doneBanner: string;
};

type Props = {
  text: string;
  onClose?: () => void;
  undo?: { deadline: number; onUndo: () => void; disabled?: boolean } | null;
};

/** Feedback after an action (NF8), with Undo for 30 seconds when it can be undone (D18). */
export function FeedbackBanner({ text, onClose, undo }: Props) {
  const t = useT();
  return (
    <div role="status" className="flex items-start gap-2 rounded-control bg-success px-3.5 py-2.5 text-sm text-on-accent-soft">
      <CheckIcon className="mt-px size-4 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="font-medium">{text}</span>
        {undo && (
          <span className="flex">
            <UndoButton key={undo.deadline} {...undo} />
          </span>
        )}
      </div>
      {onClose && (
        <IconButton label={t.common.close} size="sm" className="-my-1 -mr-1.5 bg-transparent hover:bg-surface/60" onClick={onClose}>
          <CloseIcon className="size-4" />
        </IconButton>
      )}
    </div>
  );
}
