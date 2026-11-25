"use client";

import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/cn";

export type StatusKind = "unpaid" | "resting" | "notReady" | "toCheck" | "paid" | "playing" | "live" | "draft" | "ended";

const STYLES: Record<StatusKind, string> = {
  unpaid: "bg-warn text-warn",
  resting: "bg-chip text-secondary",
  notReady: "bg-warn text-warn",
  toCheck: "bg-chip text-secondary",
  paid: "bg-success text-on-accent-soft",
  playing: "bg-accent-soft text-on-accent-soft",
  live: "bg-accent text-on-accent",
  draft: "bg-chip text-secondary",
  ended: "bg-chip text-secondary",
};

const DOT: Partial<Record<StatusKind, string>> = {
  notReady: "bg-warn-dot",
  live: "bg-[#1e2a06]",
};

/** One word per state, everywhere (D19); never color alone. */
export function StatusChip({ kind, className }: { kind: StatusKind; className?: string }) {
  const t = useT();
  return (
    <span
      data-status={kind}
      className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-[3px] text-xs font-medium", STYLES[kind], className)}
    >
      {DOT[kind] && <span aria-hidden="true" className={cn("size-1.5 rounded-full", DOT[kind])} />}
      {t.status[kind]}
    </span>
  );
}
