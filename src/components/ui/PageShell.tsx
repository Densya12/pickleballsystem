import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type PageShellProps = {
  header?: ReactNode;
  children: ReactNode;
  /** Optional footer that sticks to the bottom of the viewport (e.g. the main action). */
  footer?: ReactNode;
  className?: string;
};

const column = "mx-auto w-full max-w-app px-4";

/**
 * Mobile-first page frame: header, scrolling body, optional sticky footer.
 * Content is capped at 430px and centered on wider screens. The footer holds
 * actions, so it never prints.
 */
export function PageShell({ header, children, footer, className }: PageShellProps) {
  return (
    <div className={cn("flex min-h-dvh flex-col bg-page", className)}>
      {header && (
        <header className={cn(column, "pt-[max(0.75rem,env(safe-area-inset-top))] pb-2")}>
          {header}
        </header>
      )}
      <main className={cn(column, "flex-1 pt-2 pb-8")}>{children}</main>
      {footer && (
        <footer className="sticky bottom-0 border-t border-default bg-page/95 backdrop-blur-sm print:hidden">
          <div className={cn(column, "pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]")}>
            {footer}
          </div>
        </footer>
      )}
    </div>
  );
}
