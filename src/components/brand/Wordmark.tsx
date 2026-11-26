import type { CSSProperties } from "react";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { BallShapes } from "./Ball";

type Props = {
  /** "light": ink text on a light background (the ball gets a thin ink edge). "dark": white text on ink. */
  tone?: "light" | "dark";
  /** Font size in px. Without it the wordmark takes the surrounding font size (e.g. a text-* class). */
  size?: number;
  className?: string;
};

/**
 * The Pilaball wordmark (D21): lowercase "pilaball" in Space Grotesk 600. The
 * i is a dotless ı (U+0131) whose dot is the lime ball, placed and sized in em
 * so it scales with the text. Screen readers hear "Pilaball"; the letters and
 * the ball are hidden from them.
 *
 * Space Grotesk is loaded with the latin-ext subset as well (layout.tsx), so
 * the ı never falls back to another font.
 */
export function Wordmark({ tone = "light", size, className }: Props) {
  const dark = tone === "dark";
  // From N-Logo.dc.html at 40px: 14px ball 6px above the ı on light, 13px / 5px on ink.
  const ball: CSSProperties = dark
    ? { width: "0.34em", height: "0.34em", top: "-0.12em" }
    : { width: "0.36em", height: "0.36em", top: "-0.15em" };
  return (
    <span
      role="img"
      aria-label={APP_NAME}
      data-wordmark={tone}
      style={size ? { fontSize: `${size}px` } : undefined}
      className={cn(
        "inline-block pt-[0.2em] font-display leading-none font-semibold tracking-[-0.03em] whitespace-nowrap",
        dark ? "text-on-primary" : "text-ink",
        className,
      )}
    >
      <span aria-hidden="true">
        p
        <span className="relative inline-block">
          {"ı"}
          <svg
            aria-hidden="true"
            focusable="false"
            data-wordmark-ball=""
            viewBox="0 0 24 24"
            className="absolute left-1/2 -translate-x-1/2"
            style={ball}
          >
            <BallShapes edge={!dark} />
          </svg>
        </span>
        laball
      </span>
    </span>
  );
}
