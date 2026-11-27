import { useT } from "@/lib/i18n/client";
import { levelNumber } from "@/lib/queue/players";
import { cn } from "@/lib/cn";
import { LevelBall } from "./LevelBall";

/**
 * A player's level on rows (D25): a small ball and the number ("3"), or an
 * outline ball and "Not set". Screen readers hear "Level 3".
 */
export function LevelBadge({ level, className }: { level: string; className?: string }) {
  const t = useT();
  const n = levelNumber(level);
  return (
    <span data-level={n ?? "none"} className={cn("inline-flex shrink-0 items-center gap-1 text-sm text-secondary", className)}>
      <LevelBall filled={n !== null} className="size-4" />
      {n === null ? (
        t.levels.notSet
      ) : (
        <>
          <span className="sr-only">{t.levels.level(n)}</span>
          <span aria-hidden="true">{n}</span>
        </>
      )}
    </span>
  );
}
