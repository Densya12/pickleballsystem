import type { ComponentType, SVGProps } from "react";
import { BallIcon, CheckIcon, ClockIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { SessionStatus } from "@/lib/session/data";

type Config = {
  label: string;
  Icon: ComponentType<Omit<SVGProps<SVGSVGElement>, "aria-hidden" | "children">>;
  className: string;
};

/** Session status chip: icon + words, never color alone (BR1). */
export const SESSION_STATUS: Record<SessionStatus, Config> = {
  draft: { label: "Draft", Icon: ClockIcon, className: "bg-subtle text-ink border-default" },
  live: { label: "Live ngayon", Icon: BallIcon, className: "bg-accent text-ink border-transparent" },
  ended: { label: "Tapos na", Icon: CheckIcon, className: "bg-subtle text-muted border-default" },
};

export function SessionStatusLabel({ status, className }: { status: SessionStatus; className?: string }) {
  const { label, Icon, className: statusClassName } = SESSION_STATUS[status];
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold leading-tight",
        statusClassName,
        className,
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>{label}</span>
    </span>
  );
}
