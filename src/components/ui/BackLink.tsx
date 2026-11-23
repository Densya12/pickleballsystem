import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { ChevronLeftIcon } from "./icons";

export type BackLinkProps = Omit<ComponentProps<typeof Link>, "children"> & {
  label?: string;
};

/**
 * Chevron + "Bumalik". The brief asks for >= 44px; it is 48px tall to also
 * meet the app-wide 48px tap-target rule.
 */
export function BackLink({ label = "Bumalik", className, ...props }: BackLinkProps) {
  return (
    <Link
      className={cn(
        "-ml-2 inline-flex min-h-12 self-start items-center gap-1 rounded-control px-2 text-body font-semibold text-ink",
        "hover:bg-subtle focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus",
        className,
      )}
      {...props}
    >
      <ChevronLeftIcon className="size-6 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}
