import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TabItem = {
  key: string;
  label: string;
  /** The tab's plain name for messages ("Queue", not "Queue · 8"). Defaults to label. */
  navLabel?: string;
  icon: ReactNode;
  href?: string;
  onClick?: () => void;
  /** While the screen loads (e.g. More before the session's data is there). */
  disabled?: boolean;
  /** A number to act on (shown as a badge). */
  badge?: number;
  badgeLabel?: string;
};

const item =
  "relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-full py-[7px] text-xs font-medium " +
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** A floating pill tab bar at the bottom (D19), above the home indicator. */
export function TabBar({ label, items, current, width = "w-[84px]" }: { label: string; items: TabItem[]; current: string; width?: string }) {
  return (
    <nav
      aria-label={label}
      className="fixed bottom-[max(1rem,calc(env(safe-area-inset-bottom)+0.5rem))] left-1/2 z-30 flex -translate-x-1/2 gap-0.5 rounded-full border border-tabbar bg-surface/95 p-1.5 shadow-float backdrop-blur print:hidden"
    >
      {items.map((tab) => {
        const active = tab.key === current;
        const className = cn(item, width, active ? "bg-primary text-on-primary" : "text-muted hover:text-ink");
        // "Payments, 4 to act on": the badge is read as part of the tab's name.
        const name = tab.badge && tab.badgeLabel ? `${tab.label}, ${tab.badgeLabel}` : undefined;
        const content = (
          <>
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge ? (
              <span className="absolute top-[3px] right-[18px] flex h-4 min-w-4 items-center justify-center rounded-full bg-badge px-1 text-xs leading-none font-semibold text-on-primary">
                <span aria-hidden="true">{tab.badge}</span>
              </span>
            ) : null}
          </>
        );
        return tab.href ? (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            aria-label={name}
            data-nav-label={tab.navLabel ?? tab.label}
            className={className}
          >
            {content}
          </Link>
        ) : (
          <button key={tab.key} type="button" onClick={tab.onClick} disabled={tab.disabled} aria-haspopup="dialog" aria-label={name} className={className}>
            {content}
          </button>
        );
      })}
    </nav>
  );
}
