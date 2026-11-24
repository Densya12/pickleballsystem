"use client";

import { Button, Notice } from "@/components/ui";
import { ClockIcon } from "@/components/ui/icons";
import type { OutboxItem } from "@/lib/outbox/rules";

type Props = {
  online: boolean;
  pending: readonly OutboxItem[];
  failed: { item: OutboxItem; message: string } | null;
  onDiscard: () => void;
};

/** NF10: offline banner, the actions waiting for signal, and a failed one to discard. */
export function OutboxStatus({ online, pending, failed, onDiscard }: Props) {
  return (
    <>
      {!online && (
        <div role="status" className="rounded-control border-[1.5px] border-ink bg-warn px-4 py-3 font-semibold text-warn">
          Offline — ise-save pagbalik ng signal
        </div>
      )}
      {failed && (
        <Notice kind="error">
          <div className="flex flex-col gap-2">
            <span>
              Hindi naituloy: {failed.item.label}. {failed.message}
            </span>
            <Button variant="danger-outline" fullWidth onClick={onDiscard}>
              Itapon ang aksyon na ito
            </Button>
          </div>
        </Notice>
      )}
      {pending.length > 0 && (
        <section aria-label="Hinihintay ang signal" className="flex flex-col gap-1 rounded-control bg-subtle px-4 py-3">
          <p className="inline-flex items-center gap-2 font-semibold">
            <ClockIcon />
            Hinihintay ang signal ({pending.length})
          </p>
          <ul className="flex flex-col gap-0.5 pl-7">
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
