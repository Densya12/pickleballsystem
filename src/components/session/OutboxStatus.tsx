"use client";

import { Button } from "@/components/ui";
import { AlertIcon, ClockIcon } from "@/components/ui/icons";
import { useT } from "@/lib/i18n/client";
import type { OutboxItem } from "@/lib/outbox/rules";

type Props = {
  online: boolean;
  pending: readonly OutboxItem[];
  failed: { item: OutboxItem; message: string } | null;
  onDiscard: () => void;
};

/** NF10: the offline bar, the actions waiting for signal, and a failed one to discard. */
export function OutboxStatus({ online, pending, failed, onDiscard }: Props) {
  const t = useT();
  return (
    <>
      {!online && (
        <div role="status" className="flex items-center gap-2 rounded-control bg-warn px-3.5 py-2.5 text-sm font-semibold text-warn">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-warn-dot" />
          {t.live.offline}
        </div>
      )}
      {failed && (
        <div role="alert" className="flex flex-col gap-2 rounded-control bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
          <span className="flex items-start gap-2">
            <AlertIcon className="mt-px size-4 shrink-0" />
            {t.live.failedAction(failed.item.label, failed.message)}
          </span>
          <Button variant="danger-outline" size="sm" onClick={onDiscard} className="self-start">
            {t.live.discard}
          </Button>
        </div>
      )}
      {pending.length > 0 && (
        <section aria-label={t.live.waitingForSignal(pending.length).replace(/\s*\(\d+\)$/, "")} className="rounded-control bg-surface px-3.5 py-2.5 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <ClockIcon className="size-4" />
            {t.live.waitingForSignal(pending.length)}
          </p>
          <ul className="mt-1 flex flex-col gap-0.5 pl-6 text-muted">
            {pending.map((item) => (
              <li key={item.id} className="[overflow-wrap:anywhere]">
                {item.label}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
