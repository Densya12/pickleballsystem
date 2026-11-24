import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** "none" for cards whose rows supply their own padding (e.g. dividers). */
  padding?: "md" | "none";
};

export function Card({ className, padding = "md", ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-default bg-surface shadow-card",
        padding === "md" && "p-5",
        className,
      )}
      {...props}
    />
  );
}
