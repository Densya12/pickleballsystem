import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** "none" for cards whose rows supply their own padding. */
  padding?: "md" | "none";
};

/** White card on the page background: no border, no box inside a box (D19). */
export function Card({ className, padding = "md", ...props }: CardProps) {
  return <div className={cn("rounded-card bg-surface", padding === "md" && "p-4", className)} {...props} />;
}
