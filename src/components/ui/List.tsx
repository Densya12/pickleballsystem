import Link from "next/link";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ChevronRightIcon } from "./icons";

/** A grouped white list with 1px hairline dividers (D19). */
export function ListGroup({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn("divide-y divide-hairline overflow-hidden rounded-group bg-surface", className)} {...props} />;
}

const row = "flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left";
const interactive =
  "hover:bg-info focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus";

type RowContent = {
  children: ReactNode;
  /** Right side: a value, a chip or a button. */
  trailing?: ReactNode;
  chevron?: boolean;
};

function Inner({ children, trailing, chevron }: RowContent) {
  return (
    <>
      <span className="flex min-w-0 flex-1 flex-col">{children}</span>
      {trailing}
      {chevron && <ChevronRightIcon className="size-4 shrink-0 text-[#9aa09c]" />}
    </>
  );
}

/** A list row: static, a link (href) or a button (onClick). */
export function ListRow({
  href,
  onClick,
  className,
  children,
  trailing,
  chevron,
  ...rest
}: RowContent & {
  href?: ComponentProps<typeof Link>["href"];
  onClick?: () => void;
  className?: string;
} & Omit<HTMLAttributes<HTMLLIElement>, "onClick" | "children">) {
  return (
    <li className={className} {...rest}>
      {href !== undefined ? (
        <Link href={href} className={cn(row, interactive)}>
          <Inner trailing={trailing} chevron={chevron ?? true}>
            {children}
          </Inner>
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={cn(row, interactive)}>
          <Inner trailing={trailing} chevron={chevron}>
            {children}
          </Inner>
        </button>
      ) : (
        <div className={row}>
          <Inner trailing={trailing} chevron={chevron}>
            {children}
          </Inner>
        </div>
      )}
    </li>
  );
}

/** Primary line + optional secondary line, for a list row. */
export function RowText({ title, detail, detailTone = "muted" }: { title: ReactNode; detail?: ReactNode; detailTone?: "muted" | "warn" | "success" }) {
  return (
    <>
      <span className="font-medium [overflow-wrap:anywhere]">{title}</span>
      {detail && (
        <span
          className={cn(
            "text-sm",
            detailTone === "warn" ? "text-warn" : detailTone === "success" ? "text-success" : "text-muted",
          )}
        >
          {detail}
        </span>
      )}
    </>
  );
}

/** Small muted label above a group ("Upcoming", "Unpaid"). */
export function SectionLabel({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <h2 id={id} className={cn("section-label mx-1 mb-2", className)}>
      {children}
    </h2>
  );
}

/** A labelled section: muted label + its content. */
export function Section({
  id,
  label,
  children,
  className,
}: {
  id: string;
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={`${id}-label`} className={cn("flex flex-col", className)}>
      <SectionLabel id={`${id}-label`}>{label}</SectionLabel>
      {children}
    </section>
  );
}

/** Empty state: what's missing and the next step. */
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-group bg-surface px-4 py-4 text-muted">{children}</p>;
}
