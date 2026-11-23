import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/cn";
import { BallIcon, CheckIcon, ClockIcon, PauseIcon } from "./icons";

export type StatusKind = "paid" | "pending" | "hold" | "playing";

type StatusConfig = {
  label: string;
  Icon: ComponentType<Omit<SVGProps<SVGSVGElement>, "aria-hidden" | "children">>;
  className: string;
};

/** Status is always icon + text (never color alone). */
export const STATUS: Record<StatusKind, StatusConfig> = {
  paid: { label: "Bayad", Icon: CheckIcon, className: "bg-success text-success border-transparent" },
  pending: { label: "I-check", Icon: ClockIcon, className: "bg-subtle text-ink border-default" },
  hold: { label: "Hold · bayad muna", Icon: PauseIcon, className: "bg-warn text-warn border-transparent" },
  playing: {
    label: "Naglalaro",
    Icon: BallIcon,
    className: "bg-accent-soft text-on-accent-soft border-accent",
  },
};

export type StatusLabelProps = {
  kind: StatusKind;
  className?: string;
};

export function StatusLabel({ kind, className }: StatusLabelProps) {
  const { label, Icon, className: kindClassName } = STATUS[kind];
  return (
    <span
      data-status={kind}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-base font-semibold leading-tight",
        kindClassName,
        className,
      )}
    >
      <Icon className="size-[18px] shrink-0" />
      <span>{label}</span>
    </span>
  );
}
