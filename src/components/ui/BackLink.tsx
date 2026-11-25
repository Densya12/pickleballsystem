import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { ChevronLeftIcon } from "./icons";

export type BackLinkProps = Omit<ComponentProps<typeof Link>, "children"> & {
  /** Where it goes, e.g. "Home" (D19: "‹ Home"). */
  label: string;
};

/** "‹ Home": chevron + the screen it goes back to. 44px tall. */
export function BackLink({ label, className, ...props }: BackLinkProps) {
  return (
    <Link
      className={cn(
        "-ml-1.5 inline-flex min-h-11 items-center gap-0.5 self-start rounded-control pr-2 pl-0.5 text-body text-ink",
        "hover:bg-surface focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus",
        className,
      )}
      {...props}
    >
      <ChevronLeftIcon className="size-5 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}
