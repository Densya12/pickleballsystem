"use client";

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";

/*
 * Skeleton loading (first loads only). Shapes are decorative (aria-hidden);
 * the region around them says "Loading…" to screen readers and is aria-busy.
 * Animation and the 150 ms appear delay live in globals.css (.skeleton).
 */

type Size = number | string;
const px = (value: Size | undefined) => (typeof value === "number" ? `${value}px` : value);

/** The loading area: aria-busy, with a visually hidden, localized "Loading…". */
export function SkeletonRegion({ children, className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  const t = useT();
  return (
    <div aria-busy="true" data-skeleton="" className={className} {...rest}>
      <span className="sr-only">{t.common.loading}</span>
      {children}
    </div>
  );
}

/** A rounded block (a button, a field, a chip, a bar). */
export function Skeleton({
  width,
  height,
  rounded = "control",
  className,
  style,
}: {
  width?: Size;
  height?: Size;
  rounded?: "control" | "card" | "group" | "full" | "button";
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "skeleton block shrink-0",
        rounded === "full" && "rounded-full",
        rounded === "control" && "rounded-control",
        rounded === "card" && "rounded-card",
        rounded === "group" && "rounded-group",
        rounded === "button" && "rounded-button",
        className,
      )}
      style={{ width: px(width), height: px(height), ...style }}
    />
  );
}

const lineSizes = {
  xs: "text-xs",
  sm: "text-sm",
  body: "text-body",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
  "3xl": "text-3xl",
  "display-court": "font-display text-display-court",
  "display-number": "font-display text-display-number",
  /** Inherit the font size and line height (e.g. inside a title). */
  inherit: "",
} as const;

/**
 * One line of text: takes exactly the line box of that text size (so nothing
 * moves when the text arrives), with a bar about the height of the letters.
 */
export function SkeletonLine({
  size = "body",
  width = "60%",
  className,
}: {
  size?: keyof typeof lineSizes;
  width?: Size;
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={cn("block", lineSizes[size], className)}>
      <span
        className={cn(
          "skeleton inline-block h-[0.72em] max-w-full align-middle",
          // Big numbers read as a block, not a dot.
          size.startsWith("display") ? "rounded-2xl" : "rounded-full",
        )}
        style={{ width: px(width) }}
      />
    </span>
  );
}

/** A circle (number badges, icon buttons). */
export function SkeletonCircle({ size, className }: { size: number; className?: string }) {
  return <Skeleton width={size} height={size} rounded="full" className={className} />;
}

/** A court the shape of the mini court (440×200). */
export function SkeletonCourt({ className }: { className?: string }) {
  return <Skeleton rounded="control" className={cn("w-full", className)} style={{ aspectRatio: "440 / 200" }} />;
}

/**
 * A white card: shapes inside use the lighter card tone. Padding and radius are
 * props (cn() doesn't merge classes, so p-4 plus p-3.5 would keep p-4).
 */
export function SkeletonCard({
  children,
  className,
  padding = "p-4",
  rounded = "card",
}: {
  children: ReactNode;
  className?: string;
  /** A Tailwind padding class, matching the real card. */
  padding?: string;
  rounded?: "card" | "group";
}) {
  return (
    <div className={cn("skeleton-card bg-surface", rounded === "card" ? "rounded-card" : "rounded-group", padding, className)}>{children}</div>
  );
}

/** A labelled form field: label line, then the 46px field. */
export function SkeletonField({ labelWidth = 96, className }: { labelWidth?: Size; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <SkeletonLine size="sm" width={labelWidth} />
      <Skeleton height={46} className="w-full" />
    </div>
  );
}
