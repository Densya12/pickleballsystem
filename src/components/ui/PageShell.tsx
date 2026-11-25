import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type PageShellProps = {
  /** Top row: back link on the left, icon buttons and pills on the right. */
  top?: ReactNode;
  /** Small muted line above the title. */
  eyebrow?: ReactNode;
  title?: ReactNode;
  /** 30px on top-level screens (Home, Settings), 28px elsewhere. */
  titleSize?: "lg" | "xl";
  /** Small muted line under the title. */
  subtitle?: ReactNode;
  children: ReactNode;
  /** The screen's one main button, kept at the bottom. */
  footer?: ReactNode;
  /** A floating tab bar; content is padded so nothing hides behind it. */
  tabBar?: ReactNode;
  className?: string;
};

const column = "mx-auto w-full max-w-app px-4";

/** Mobile-first frame (D19): top row, large title, content, then a main button or a tab bar. */
export function PageShell({ top, eyebrow, title, titleSize = "lg", subtitle, children, footer, tabBar, className }: PageShellProps) {
  return (
    <div className={cn("flex min-h-dvh flex-col bg-page", className)}>
      <header className={cn(column, "pt-[max(1rem,env(safe-area-inset-top))]")}>
        {top && <div className="flex min-h-11 items-center justify-between gap-2 print:hidden">{top}</div>}
        {(eyebrow || title || subtitle) && (
          <div className={cn("px-1", top ? "pt-2" : "pt-8")}>
            {eyebrow && <div className="text-sm text-muted [overflow-wrap:anywhere]">{eyebrow}</div>}
            {title && (
              <h1
                className={cn(
                  "title-large [overflow-wrap:anywhere]",
                  titleSize === "xl" && "[font-size:30px] tracking-[-0.5px]",
                  Boolean(eyebrow) && "mt-0.5",
                )}
              >
                {title}
              </h1>
            )}
            {subtitle && <div className="mt-1 text-sm text-muted [overflow-wrap:anywhere]">{subtitle}</div>}
          </div>
        )}
      </header>
      <main
        className={cn(
          column,
          "flex-1 pt-4",
          tabBar ? "pb-[calc(7rem+env(safe-area-inset-bottom))]" : footer ? "pb-6" : "pb-10",
        )}
      >
        {children}
      </main>
      {footer && (
        <footer className="sticky bottom-0 bg-page/95 backdrop-blur-sm print:hidden">
          <div className={cn(column, "pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]")}>{footer}</div>
        </footer>
      )}
      {tabBar}
    </div>
  );
}
