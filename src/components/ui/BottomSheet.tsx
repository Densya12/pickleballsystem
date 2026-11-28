"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Small line under the title. */
  subtitle?: ReactNode;
  children: ReactNode;
};

/** A modal sheet from the bottom (native <dialog>: focus trap and Escape for free). */
export function BottomSheet({ open, onClose, title, subtitle, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    else if (!open && dialog.open) dialog.close();
    // A link in the sheet navigates away; Next keeps the old page mounted but
    // hidden (its effects are cleaned up). A modal dialog left open there would
    // keep the new page inert, so close it whenever this effect is cleaned up.
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        // A tap on the dimmed backdrop closes the sheet.
        if (event.target === ref.current) onClose();
      }}
      aria-labelledby={titleId}
      className="fixed inset-x-0 top-auto bottom-0 m-0 mx-auto w-full max-w-app rounded-t-[24px] bg-page p-0 text-ink backdrop:bg-primary/40"
    >
      {open && (
        <div className="flex flex-col gap-3 px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <span aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-input" />
          <div className="px-1">
            <h2 id={titleId} className="font-display text-xl [overflow-wrap:anywhere]">
              {title}
            </h2>
            {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
