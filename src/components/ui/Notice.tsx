import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { AlertIcon, CheckIcon, InfoIcon } from "./icons";

export type NoticeKind = "success" | "error" | "info";

const STYLES: Record<NoticeKind, { className: string; Icon: typeof CheckIcon; role?: "status" | "alert" }> = {
  success: { className: "bg-success text-success", Icon: CheckIcon, role: "status" },
  error: { className: "bg-surface text-danger border-danger", Icon: AlertIcon, role: "alert" },
  info: { className: "bg-subtle text-ink", Icon: InfoIcon },
};

export type NoticeProps = {
  kind: NoticeKind;
  children: ReactNode;
  className?: string;
};

/**
 * A message block: icon + text, never color alone. Success is announced
 * politely (role="status"), errors immediately (role="alert").
 */
export function Notice({ kind, children, className }: NoticeProps) {
  const { className: kindClassName, Icon, role } = STYLES[kind];
  return (
    <div
      role={role}
      className={cn(
        "flex items-start gap-2.5 rounded-control border border-transparent px-4 py-3 text-base font-medium",
        kindClassName,
        className,
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
