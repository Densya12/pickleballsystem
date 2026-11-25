import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { AlertIcon, CheckIcon, InfoIcon } from "./icons";

export type NoticeKind = "success" | "error" | "info" | "warning";

const STYLES: Record<NoticeKind, { className: string; Icon: typeof CheckIcon; role?: "status" | "alert" }> = {
  success: { className: "bg-success text-on-accent-soft", Icon: CheckIcon, role: "status" },
  error: { className: "bg-danger-soft text-danger", Icon: AlertIcon, role: "alert" },
  info: { className: "bg-surface text-ink", Icon: InfoIcon },
  warning: { className: "bg-warn text-warn", Icon: AlertIcon, role: "status" },
};

export type NoticeProps = {
  kind: NoticeKind;
  children: ReactNode;
  className?: string;
  /** false: no live role (a second, quiet copy of a message already announced). */
  live?: boolean;
  /** Lets the message take focus (e.g. after a failed submit). */
  tabIndex?: number;
  "data-form-error"?: boolean;
};

/**
 * A short message: icon + text, never color alone. Success and warnings are
 * announced politely (role="status"), errors immediately (role="alert").
 */
export function Notice({ kind, children, className, live = true, tabIndex, "data-form-error": formError }: NoticeProps) {
  const { className: kindClassName, Icon, role } = STYLES[kind];
  return (
    <div
      role={live ? role : undefined}
      tabIndex={tabIndex}
      data-form-error={formError || undefined}
      className={cn(
        "flex items-start gap-2 rounded-control px-3.5 py-2.5 text-sm font-medium focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus",
        kindClassName,
        className,
      )}
    >
      <Icon className="mt-px size-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
