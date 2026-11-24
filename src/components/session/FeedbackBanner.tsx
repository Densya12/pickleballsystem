"use client";

import { Notice } from "@/components/ui";
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

/** Feedback after an action (NF8), with "Ibalik" for 30 seconds when it can be undone (D18). */
export function FeedbackBanner({ text, onClose, undo }: Props) {
  return (
    <Notice kind="success">
      <div className="flex flex-col gap-2">
        <span>{text}</span>
        {(undo || onClose) && (
          <div className="-mb-1 flex flex-wrap items-center gap-2">
            {undo && <UndoButton key={undo.deadline} {...undo} />}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="min-h-12 shrink-0 rounded-control px-3 font-semibold underline underline-offset-2 focus-visible:outline-3 focus-visible:outline-focus"
              >
                Isara
              </button>
            )}
          </div>
        )}
      </div>
    </Notice>
  );
}
